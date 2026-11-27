# Submission: Ajaia Docs

**Candidate:** Sneh Patel
**Live URL:** https://ajaia-docs-ten-chi.vercel.app
**Walkthrough video:** see `VIDEO_URL.txt`

## Test accounts

Password for all: `demo1234`

- `alice@ajaia.test`: owner of the welcome document
- `bob@ajaia.test`: editor on Alice's welcome document
- `carol@ajaia.test`: viewer on Alice's welcome document

## What's included

| Item | Location |
|---|---|
| Source code | `backend/` (FastAPI) and `frontend/` (React) |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Automated tests | `backend/tests/` (run `pytest` in `backend/`) |
| Deployment config | `vercel.json`, `app.py` (Vercel entrypoint), `Dockerfile` (local) |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `screenshots/` |

## Status

**Working end to end**
- Create, rename, edit, delete documents with bold, italic, underline, headings, bulleted and numbered lists
- Autosave; documents and formatting persist across refresh
- Import .txt, .md, .docx as a new document (other types rejected with a message)
- Sharing by email with viewer/editor roles; separate "My documents" and "Shared with me" lists; owner can change or remove access
- Conflict detection when two people save the same document
- Deployed on Vercel with Neon Postgres

**Not included (deliberate)**
- Real-time co-editing and presence
- Sign-up / password reset
- Comments, version history, export
- Images and video in documents

**Next 2–4 hours**
1. Version history with restore
2. Images in documents and video embeds by link
3. Alembic migrations, login rate limiting
4. Presence indicator, then real-time editing (Yjs)
