# Ajaia Docs

A small collaborative document editor: create and format documents, import files, and share them with teammates as viewers or editors.

**Live demo:** https://ajaia-docs-ten-chi.vercel.app

## Stack

- **Frontend:** React 18, Vite, TipTap (rich-text editor), React Router
- **Backend:** Python 3.12, FastAPI, SQLAlchemy
- **Database:** Postgres (Neon) in production, SQLite locally
- **Hosting:** Vercel (frontend on the CDN, API as a serverless function)
- **Tests:** pytest API tests (in `backend/tests`); the user flows were also checked in a real browser with Playwright

## Demo accounts

All passwords are `demo1234`. The login page has buttons that fill these in.

| User  | Email              | What to try                                      |
|-------|--------------------|--------------------------------------------------|
| Alice | alice@ajaia.test   | Owns "Welcome to Ajaia Docs", can share it       |
| Bob   | bob@ajaia.test     | Has **edit** access to Alice's welcome doc       |
| Carol | carol@ajaia.test   | Has **view-only** access to Alice's welcome doc  |

Quick sharing test: log in as Alice → open a doc → **Share** → add `bob@ajaia.test` as "Can edit". Log out, log in as Bob → the doc is under **Shared with me**. Use a private window for a second user to see both at once.

## Features

- Create, rename, edit and delete documents
- Rich text: bold, italic, underline, headings (H1–H3), bulleted and numbered lists, quotes, undo/redo
- Autosave (1 second after you stop typing) with a "Saving… / Saved" indicator
- **Import** a `.txt`, `.md` or `.docx` file (max 2 MB) as a new editable document
- **Sharing** by email with two roles: *Can view* (read-only) and *Can edit*. Owner can change roles or remove access
- App layout with a sidebar: New / Import, **My documents** and **Shared with me** (with counts), recent documents, and your account. On phones the sidebar becomes a slide-in menu
- Document list with search by title, owner, "last edited" time, and who it's shared with (or your access level for shared docs)
- Editor header shows the avatars of everyone with access
- If two people edit the same doc, the second save is rejected instead of silently overwriting the first person's work, and the user is asked to reload

## Run locally

Needs Python 3.11+ and Node 18+.

```bash
# 1. backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt   # includes ../requirements.txt

# 2. frontend (in another terminal)
cd frontend
npm install
npm run build                   # FastAPI serves frontend/dist

# 3. start
cd backend
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000. A SQLite file `backend/app.db` is created and seeded with the demo users on first start. Delete it to reset.

For frontend development with hot reload, run `npm run dev` in `frontend/` and open http://localhost:5173 (API calls are proxied to port 8000).

### With Docker

```bash
docker build -t ajaia-docs .
docker run -p 8000:8000 ajaia-docs
```

## Tests

```bash
cd backend
pytest
```

11 API tests run against the real app and a real SQLite database: login, create/rename/edit/reopen, HTML sanitizing, the full sharing flow (owner / editor / viewer / no access), the stale-save conflict, and file import. To run them on Postgres: `TEST_DATABASE_URL=postgresql://... pytest`.

## Deployment

Deployed on **Vercel** with a free **Neon Postgres** database. Every push to `main` deploys automatically.

- `app.py` (repo root) is the entrypoint Vercel looks for; it loads `backend/main.py`
- `vercel.json` builds the React app into `public/`, which Vercel serves from its CDN
- Python dependencies are in the root `requirements.txt`

Environment variables (set in the Vercel project):

| Variable        | Purpose                                                        |
|-----------------|----------------------------------------------------------------|
| `DATABASE_URL`  | Postgres connection string (added by the Neon integration). If unset, uses local SQLite |
| `SECRET_KEY`    | Signs the session cookie. Required when using Postgres. If unset locally/in Docker, a random key is generated on each start (you get logged out on restart) |
| `COOKIE_SECURE` | Set to `1` on HTTPS so the cookie is only sent over HTTPS      |

## Project layout

```
backend/
  main.py          API routes, access checks, serves the frontend
  models.py        User, Document, Share tables
  database.py      DB connection (SQLite locally, Postgres in prod)
  auth.py          password hashing + "who is logged in"
  file_import.py   .txt/.md/.docx -> HTML, HTML sanitizing
  seed.py          demo users and welcome document
  tests/           pytest API tests
frontend/src/
  pages/           Login, DocList, EditorPage
  components/      AppLayout (sidebar), Toolbar, ShareDialog, Avatar
  api.js           fetch wrapper
  useAutosave.js   autosave + conflict handling for the editor
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for decisions and tradeoffs and [AI_WORKFLOW.md](AI_WORKFLOW.md) for how AI was used.
