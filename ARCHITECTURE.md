# Architecture note

## What I built and what I prioritized

A small document editor where you can write, import a file, share with a teammate as a viewer or editor, and both of you see the same document. I went for depth on that core loop (**write → save → share → someone else opens it**) and made each step handle its obvious failure cases, instead of adding many shallow features.

## How the parts connect

```
Browser: React + TipTap editor
   │  JSON over /api (same domain, session cookie)
   ▼
FastAPI (Python) ── one Vercel serverless function
   │  SQLAlchemy
   ▼
Postgres (Neon) in production · SQLite file locally
```

Vercel serves the built React app from its CDN; `/api/*` goes to FastAPI. Tables: `users`, `documents` (with `owner_id` and a `version` number) and `shares` (`document_id`, `user_id`, `role` = viewer | editor).

## Key decisions

- **One permission check.** Every document route calls `load_doc(..., need="view" | "edit" | "owner")`. No access returns **404**, not 403, so nobody can probe which document IDs exist. The UI hides editing for viewers, but the server is the real check.
- **No silent overwrites.** Autosave (`frontend/src/useAutosave.js`) sends the document 1 s after typing stops, with the version it last saw. The server saves with `UPDATE … WHERE id = ? AND version = ?`; if someone else saved first, nothing updates and the API returns **409**, and the editor shows a "reload" banner. Doing the check inside the `UPDATE` keeps it correct even when two saves arrive at the same instant.
- **Content is HTML, sanitized on the server.** TipTap reads and writes HTML, so formatting round-trips unchanged. `nh3` strips everything the editor can't produce, so a crafted request can't store a `<script>`.
- **Import, not attachments.** `.txt`, `.md` and `.docx` (max 2 MB) become a new editable document. Only the converted text is stored, so there's no file storage to run.
- **Stateless server.** Login is a signed cookie, nothing is kept in memory, and there are no local files. That's what lets it run as serverless functions that scale out without code changes.
- **Serverless details.** Startup may run on several instances at once, so table creation is repeatable and seeding tolerates a duplicate. Neon's connection pooler doesn't support prepared statements, so they're turned off. Secrets live only in Vercel environment variables.

## What I cut, and why

| Cut | Why |
|---|---|
| Real-time co-editing, presence | Needs WebSockets plus a CRDT (e.g. Yjs). Conflict detection already covers the data-safety part |
| Sign-up, password reset, SSO | Seeded accounts let reviewers test sharing in seconds |
| Comments, version history, export | Each is its own feature; core flow first |
| Images and video in docs | Video needs paid object storage, and reviewers mustn't pay for anything |
| Migrations, pagination, login rate limiting | Not needed at demo scale; listed below |

**Known tradeoff:** two people typing in the same document at the same moment get a conflict instead of a merge. No data is lost, but it isn't Google-Docs-level collaboration.

## Next 2–4 hours

1. Version history with restore (builds on the existing `version` column)
2. Images in documents, and video embeds by YouTube/Vimeo/Loom link
3. Alembic migrations and login rate limiting
4. "Bob is viewing" presence, then real-time editing with Yjs
