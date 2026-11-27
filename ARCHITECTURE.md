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

- **One permission check.** Every document route calls `load_doc(..., need="view" | "edit" | "owner")`. No access returns **404**, not 403, so nobody can probe which document IDs exist. The UI hides editing for viewers, but the server is the real check. A viewer who tries to save gets **403**: they can see the document exists, but not change it.
- **No silent overwrites.** Autosave (`frontend/src/useAutosave.js`) sends the document 1 s after typing stops, with the version it last saw. The server saves with `UPDATE … WHERE id = ? AND version = ?`; if someone else saved first, nothing updates, the API returns **409**, autosave pauses, and the editor shows a banner with **Copy my version** and **Reload**. Doing the check inside the `UPDATE` keeps it correct even when two saves arrive at the same instant.
- **Content is HTML, sanitized on the server.** TipTap reads and writes HTML, so formatting round-trips unchanged. `nh3` strips everything the editor can't produce, so a crafted request can't store a `<script>`.
- **Import, not attachments.** `.txt`, `.md` and `.docx` (max 2 MB) become a new editable document. Only the converted text is stored, so there's no file storage to run.
- **Stateless server.** Login is a signed cookie, nothing is kept in memory, and there are no local files. That's what lets it run as serverless functions that scale out without code changes.
- **Tests.** 17 pytest tests run against the real app and a real database. They cover the access rules (404 for no access, 403 for viewers, owner-only sharing and delete), the 409 conflict, HTML sanitizing, file import, the upload and input limits, the zip-bomb check, and that there is no hardcoded session key. These are the parts where a bug would leak data or lose it.
- **Serverless details.** Startup may run on several instances at once, so table creation is repeatable and seeding tolerates a duplicate. Neon's connection pooler doesn't support prepared statements, so they're turned off. Secrets live only in Vercel environment variables.

## What I cut, and why

| Cut | Why |
|---|---|
| Real-time co-editing, presence | Needs WebSockets plus a CRDT (e.g. Yjs). Conflict detection already covers the data-safety part |
| Sign-up, password reset, SSO | Seeded accounts let reviewers test sharing in seconds |
| Comments, version history, export | Each is its own feature; core flow first |
| Images and video in docs | Video needs paid object storage, and reviewers mustn't pay for anything |
| Migrations, pagination, login rate limiting | Not needed at demo scale; listed below |

**Known tradeoffs:**
- Two people typing in the same document at once get a conflict, not a merge. The first save wins. The second person's unsaved edit stays on their screen but is not saved: they click **Copy my version**, reload, and paste back what they need. Real merging needs a CRDT (see next steps).
- Login is a signed cookie (HttpOnly, Secure, SameSite=Lax, 7-day expiry). There's no server-side session list, so a cookie can't be revoked before it expires. Fine for a demo; production would add server-side sessions or short-lived tokens.

## Next 2–4 hours

1. Version history with restore (builds on the existing `version` column)
2. Images in documents, and video embeds by YouTube/Vimeo/Loom link
3. Alembic migrations, and login rate limiting stored in Postgres (an in-memory limiter doesn't work across serverless instances)
5. Upgrade FastAPI/Starlette for a low-severity Range-header advisory found in the security audit
4. "Bob is viewing" presence, then real-time editing with Yjs
