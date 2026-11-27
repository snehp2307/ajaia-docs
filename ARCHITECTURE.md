# Architecture note

## What I prioritized

The brief asks for depth over breadth, so I focused on making the core loop solid: **write → save → share → someone else opens it**. Each of those had to actually work end to end and handle the obvious failure cases. I cut things that would look impressive but spread the time thin (real-time co-editing, comments, sign-up).

## Stack

| Part      | Choice                         | Why |
|-----------|--------------------------------|-----|
| Frontend  | React + Vite + TipTap          | TipTap gives a solid rich-text editor (built on ProseMirror) without writing editing logic myself |
| Backend   | Python, FastAPI                | Simple, request validation with Pydantic built in, easy to test |
| Database  | SQLAlchemy → SQLite locally, Postgres in production | Zero setup locally; a real database in production. Same code for both |
| Hosting   | Vercel (FastAPI as a serverless function, React from the CDN) + Neon Postgres (free) | Free for reviewers, deploys on every push to `main`, and frontend + API share one domain so there is no CORS setup |

## Data model

```
users      (id, email, name, password_hash)
documents  (id, title, content, owner_id, version, created_at, updated_at)
shares     (document_id, user_id, role)      role = 'viewer' | 'editor'
           unique (document_id, user_id)
```

- **Content is stored as HTML.** TipTap reads and writes HTML, so formatting round-trips without a conversion step. It is sanitized on the server (with `nh3`) to only the tags the editor can produce, so a crafted request can't store a `<script>`.
- **Ownership is a column, sharing is a table.** "My documents" = `owner_id = me`. "Shared with me" = a join on `shares`. Both columns are indexed.

## Access control

Every document route goes through one function, `load_doc()`, which works out the user's role (`owner`, `editor`, `viewer`, or none):

- no access → **404** (not 403, so you can't probe which document IDs exist)
- viewer trying to save → 403
- only the owner can share, change roles or delete

The frontend also hides the toolbar and makes the editor read-only for viewers, but the server is the real check.

## Saving and conflicts

Autosave sends the whole document 1 second after the user stops typing. Each document has a `version` number. A save says "I'm editing version 5", and the server runs:

```sql
UPDATE documents SET ..., version = 6 WHERE id = ? AND version = 5
```

If someone else saved first, the version is already 6, zero rows update, and the API returns **409 Conflict**. The UI stops autosaving and shows a banner asking the user to reload. Putting the check inside the `UPDATE` (instead of reading, comparing, then writing) means it is safe even when two saves arrive at the same moment. This is optimistic locking, the standard fix for the "lost update" problem.

**Tradeoff:** this prevents data loss but doesn't merge edits. Two people typing in the same doc at the same time will get conflicts. Real-time co-editing needs a CRDT (e.g. Yjs) or operational transforms plus WebSockets, which was too much for this timebox.

## Auth

Seeded demo accounts with a lightweight login (the brief allowed this). Passwords are hashed with PBKDF2. The session is a signed cookie (`SessionMiddleware`), so the server stores no session state; any number of app instances can serve any request. The app refuses to start on Postgres without a real `SECRET_KEY`.

## File upload

Import `.txt`, `.md` or `.docx` (max 2 MB) as a new document. `.docx` is converted with `mammoth`, `.md` with `markdown`, and plain text is escaped and split into paragraphs. The result goes through the same sanitizer as editor content. Other file types get a clear error. The file itself isn't stored, only the converted content, so there's no file storage to manage.

## Deployment (Vercel + Neon)

- The root `app.py` re-exports the FastAPI app so Vercel can find it. The build step compiles the React app into `public/`, which Vercel serves from its CDN.
- Serverless functions have no disk, so all data lives in Neon Postgres. Locally the same code uses a SQLite file.
- Things I had to handle because it's serverless:
  - **Startup can run on several instances at once.** Tables are created with `create_all` (safe to repeat) and seeding catches the duplicate-email error if two instances seed at the same moment.
  - **Connections go through Neon's pooler (PgBouncer).** I turned off psycopg's automatic prepared statements, which can misbehave behind a pooler, and use `pool_pre_ping` so a stale connection from an idle instance gets replaced instead of failing a request.
  - **No secrets in code.** `SECRET_KEY` and `DATABASE_URL` are Vercel environment variables. The app refuses to start on Postgres without a real `SECRET_KEY`.
- I verified the deployed site with the same browser script I used locally (all flows passed on Postgres), then deleted the test documents it created.
- I first set it up for Render (Docker + Render Postgres) and switched to Vercel: no cold start of ~1 minute after idling, and automatic deploys from GitHub. The `Dockerfile` is still there for running locally in one command.

## How it would scale

For an internal tool (hundreds of users) one small instance + Postgres is plenty. If it grew:

- **App servers** are stateless (cookie sessions, no local files), which is why it runs on serverless at all: Vercel starts more instances under load without any change to the code.
- **Reads** of the doc lists are indexed joins, one query each (no per-row queries).
- **Writes**: every autosave rewrites the full document. Fine at this size; for large docs or many editors I'd switch to sending changes (CRDT updates) instead of the whole document.
- **Database**: one Postgres is the single source of truth. Next steps would be read replicas, then partitioning by document id if ever needed.

## What I deliberately left out

| Cut | Why |
|---|---|
| Real-time co-editing / presence | Needs WebSockets + CRDT; conflict detection covers the data-safety part |
| Sign-up / password reset / SSO | Seeded accounts make the sharing flow faster for reviewers to test |
| Comments, suggestions, version history | Nice, but each is its own feature; core flow first |
| Database migrations (Alembic) | `create_all` is enough for a fresh database; the first schema change would need Alembic |
| Pagination, rate limiting on login | Not needed at demo scale; listed in next steps |
| Image/video in documents | Video files need paid object storage; images were possible but lower priority than shipping |

## Next 2–4 hours

1. Version history: store a snapshot on each save, let the owner view/restore (the `version` column is already there)
2. Images in documents (upload, stored in Postgres) and video embeds by YouTube/Vimeo/Loom link
3. Alembic migrations and login rate limiting
4. Presence indicator ("Bob is viewing") using a simple heartbeat endpoint, then real-time editing with Yjs
