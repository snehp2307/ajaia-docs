# Submission: Ajaia Docs

**Candidate:** Sneh Patel
**Live product:** https://ajaia-docs-ten-chi.vercel.app
**Walkthrough video (4:50):** PASTE_VIDEO_LINK_HERE
**Google Drive folder:** PASTE_DRIVE_FOLDER_LINK_HERE

> Hosted on Vercel (US East) with a free Neon Postgres database. The first request after a few idle minutes can take 1-3 seconds while the free-tier server and database wake up. After that it is fast.

## Test accounts (for the sharing flow)

Password for all: `demo1234`. The login page has buttons that fill these in.

| User | Email | Access on "Welcome to Ajaia Docs" |
|---|---|---|
| Alice | `alice@ajaia.test` | Owner, can share and delete |
| Bob | `bob@ajaia.test` | Editor |
| Carol | `carol@ajaia.test` | Viewer (read-only) |

**Quick sharing test (about 1 minute):** log in as Alice, open the welcome doc, click **Share**, add Bob as "Can view", then open a private window and log in as Bob. The doc is under **Shared with me** and is read-only. Change Bob to "Can edit" in Alice's window and Bob can type.

## What is included in the Drive folder

| Item | File |
|---|---|
| Source code | `source-code.zip` (`backend/` FastAPI, `frontend/` React) |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This file | `SUBMISSION.md` |
| Walkthrough video link | `VIDEO_URL.txt` (the video file itself is also in the folder) |
| Screenshots | `screenshots/` (login, documents, editor, share dialog, shared-with-me, conflict banner, view-only, phone menu) |

## Run locally

Needs Python 3.11+ and Node 18+. Full instructions are in `README.md`; the short version:

```bash
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
cd ../frontend && npm install && npm run build
cd ../backend && uvicorn main:app --port 8000      # open http://localhost:8000
pytest                                              # 17 API tests
```

A SQLite file is created and seeded with the three demo users on first start. No external services are needed.

## What works end to end

- **Documents:** create, rename, edit, reopen. Bold, italic, underline, headings (H1-H3), bulleted and numbered lists (headings work inside lists), quotes, undo/redo. Autosave with a visible Saving/Saved status. Formatting survives a hard refresh.
- **File upload:** `.txt`, `.md` and `.docx` (max 2 MB) become a new editable document. The limits are shown in the UI. Other types, oversized files and `.docx` "zip bombs" are rejected with a clear message.
- **Sharing:** by email, with viewer and editor roles, enforced on the server (no access = 404, viewer saving = 403, only the owner can share or delete). "My documents" and "Shared with me" are separate, with owner avatars and access badges.
- **Persistence:** Postgres in production, SQLite locally. Documents and sharing survive refresh and redeploys.
- **Conflicts:** if two people save the same document, the second save is refused (409) instead of silently overwriting. The editor keeps their text and offers **Copy my version** and **Reload**.
- **Quality:** 17 pytest tests on the access rules, conflicts, sanitizing, import and security fixes; mypy-clean backend; a security audit whose two Medium findings (forgeable fallback session key, `.docx` zip bomb) are fixed with regression tests.
- **Stretch item:** role-based sharing (viewer/editor).

## Not included (deliberate cuts, reasons in ARCHITECTURE.md)

- Real-time co-editing and presence (needs WebSockets plus a CRDT; I made concurrent edits safe first)
- Sign-up, password reset, SSO (seeded accounts make sharing easy to review)
- Comments, version history, export
- Images and video inside documents
- Login rate limiting (an in-memory limiter does not work on serverless; needs a Postgres-backed counter)

## Next 2-4 hours

1. Version history with restore (the `version` column already exists)
2. Images in documents, and video embeds by link
3. Login rate limiting stored in Postgres; Alembic migrations
4. Upgrade Starlette/FastAPI (a Low-severity advisory from the audit), then presence and real-time editing with Yjs
