# AI workflow note

## Tools I used

| Tool | What I used it for |
|---|---|
| **Claude (chat)** | System design research, scoping, and reviewing my architecture note and deliverables |
| **Claude Code** | Writing and refactoring the code |
| **`ddia-systems` skill** (my own, based on *Designing Data-Intensive Applications*) | Designing the data layer: consistency, concurrency and failure cases |
| **`production-code` skill** | Readability and maintainability: structure, naming, separation of concerns |
| **`security-audit` skill** | A vulnerability pass before shipping |

**Done without AI:** gathering the functional requirements. I went through the brief line by line and used Google Docs itself to decide which behaviours were worth copying, such as the owned vs shared split, a visible save status and viewer vs editor roles. I wrote these as a checklist and tested the finished app against it.

## Where AI materially sped up my work

- **Learning the domain quickly.** I had Claude explain how Google Docs works: edits as operations, operational transformation, an op log plus snapshots, access checks on every request, presence. Then I had it compare that, step by step, with what fits in the timebox. That gave me the main decision in minutes: **snapshot saves with a version check instead of real-time sync.** It also settled which features to cut (presence, merging, version history, offline) and how to explain why.
- **Writing the code.** Claude Code wrote most of the first drafts: FastAPI routes, SQLAlchemy models, the TipTap toolbar, the `.txt`/`.md`/`.docx` converters and the test scaffolding. I spent my time on decisions and review instead of boilerplate.
- **Repeatable reviews through skills.** Instead of restating my standards in every prompt, I encoded them as skills and ran them over the code:
  - `ddia-systems` kept the data design honest. The version check is done inside the `UPDATE` so it holds when two saves land at once, the server is stateless so it can run serverless, and startup and seeding are safe to run on several instances.
  - `production-code` kept the structure clean. Routes are thin, there is one permission function (`load_doc`), and the sanitizer and converters are plain functions that are easy to test.
  - `security-audit` checked the obvious attack surface before deploy.

## What I changed or rejected

- **Rejected the AI's default stack and plan.** Early on, an assistant started building the whole app on its own choices (Node/Express, SQLite, Render). I stopped it and chose FastAPI + Vercel + Neon myself. I'm strongest in Python, which let me review and correct AI-generated code faster. FastAPI's Pydantic validation and dependency injection also fit the two things I cared most about: input validation, and a single permission check that no route can skip. Neon gave me free managed Postgres that survives serverless restarts, so reviewers don't pay for anything.
- **Corrected an overclaim in my design.** A review of my architecture note pointed out that "no data is lost on conflict" was only true for whoever saved first: the second person would lose their unsaved edit on reload. I added a **Copy my version** button and rewrote the tradeoff to say exactly what happens.
- **Fixed weak reasoning, not just code.** I rewrote my reason for cutting images and video (the storage cost would have been mine, not the reviewers'). I also documented that signed cookies can't be revoked before they expire.
- **Security audit findings.** The `security-audit` skill confirmed two Medium issues, each with a local proof:
  - **Forgeable sessions on SQLite.** A hardcoded fallback `SECRET_KEY` meant that anyone could sign a cookie as any user on a SQLite deployment, such as the README's Docker command. I replaced it with a random per-process key (`secrets.token_urlsafe(32)`) and kept the hard requirement for a real key on Postgres. The live site was never affected.
  - **`.docx` zip bomb.** A 2 MB upload could expand to gigabytes inside mammoth and take the server down. I now reject any `.docx` whose unpacked size exceeds 20 MB, before conversion, with a regression test.
  - **Deferred on purpose:** a Low-severity Range-header issue in Starlette. Upgrading FastAPI this close to the deadline risked breaking the deploy, so it's listed under next steps with the hardening notes (rate limiting, CSP, PBKDF2 iterations). Access control, stored XSS, CSRF and SQL injection all held up under the audit.
- **Generated code I changed.** Claude Code's first version of the backend made local setup "just work" by falling back to a hardcoded `SECRET_KEY` when none was set. It looked harmless and passed every functional test, but it was the account-takeover path the audit later proved. I replaced it, and changed how I review: any default that makes generated code convenient (fallback secrets, permissive limits, skipped checks in dev mode) now gets an explicit look, because tests that check features won't catch it.

## How I verified correctness, UX quality and reliability

- **Against my own requirements checklist,** re-run on the live URL in a private window. I logged in as both seeded users and ran share → open → edit → refresh, checking that owned and shared documents are listed separately.
- **Automated tests:** 17 `pytest` tests, grouped by the parts where a bug would leak or lose data:
  - **Auth:** you must be logged in; a wrong password is rejected.
  - **Documents:** create, rename, edit and reopen; empty titles rejected; a stale save is rejected (409).
  - **Sharing:** the full owner → viewer/editor flow; unknown emails and invalid roles rejected.
  - **Content safety:** scripts stripped from saved content; `.txt` imports have their HTML escaped.
  - **Import:** Markdown import works; other file types, files over 2 MB and `.docx` zip bombs are rejected.
  - **Security fixes:** no hardcoded session secret remains.
  - **Deploys:** `index.html` is never cached and has no ETag, so reviewers always get the latest build.
- **Conflict path:** I opened the same document in two tabs, saved in both, and confirmed the 409 banner and that **Copy my version** keeps my text.
- **Formatting round-trip:** I applied bold, italic, underline, headings and lists, waited for autosave, hard-refreshed and confirmed nothing was lost.
- **Two broken deploys, caught and rolled back.** After every deploy I checked the live URL, and twice that caught a bad change before anyone else saw it:
  1. An attempt to serve the frontend from Vercel's CDN made every page return **404**.
  2. Adding a `pyproject.toml` (for Mypy settings) made Vercel install dependencies from it instead of `requirements.txt`, so every request returned **500**.

  Both were reverted within about two minutes with `git revert`, not a force-push. The second fix kept the Mypy settings by moving them to `mypy.ini`. After that, risky deploy changes went to a **preview deployment** first. That caught a third approach (Vercel's CDN promotion for FastAPI static files) that would not have worked, before it reached production.
- **Bad input:** unsupported file types, files over 2 MB, sharing with an unknown email, and both security fixes covered by regression tests (`test_docx_zip_bomb_rejected`, `test_no_hardcoded_session_secret`).

**The split I kept:** AI did the research, the drafting and the reviewing. The requirements, the scope cuts and the final call on every design decision were mine.
