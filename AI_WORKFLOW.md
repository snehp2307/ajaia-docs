# AI workflow note

> Draft written from the actual session log. **Sneh: rewrite in your own words and fill in the [TODO] parts before submitting.**

## Tools

- **Claude Code** (Anthropic's terminal coding agent, Claude Opus 5.5): wrote most of the code, tests and docs under my direction. It ran commands, tests and a headless browser on my machine.
- [TODO: add anything else you used, e.g. ChatGPT for a question, VS Code, etc. Only if you actually did.]

I used it as "AI writes, I decide and review": I made the product and scope calls, and it stopped after each slice (backend, then frontend) so I could read the code before moving on.

## Where AI sped things up

- **Scaffolding**: FastAPI routes, SQLAlchemy models, the React pages and the TipTap toolbar in minutes instead of hours.
- **Tests**: it wrote the pytest API tests (sharing permissions, the conflict case, file import), which I'd have been tempted to skip under time pressure.
- **Browser checking**: it wrote a Playwright script that logs in as Alice, Bob and Carol in separate browser sessions and clicks through the whole flow, then screenshots each step. That found bugs I wouldn't have caught by clicking around once.

## What I changed or rejected

- **Backend language.** Its first plan was a Node/Express backend. I switched it to Python because that's what I can maintain and explain.
- **Over-engineered first version.** Its first database layer was abstract (a schema + engine factory meant to be "production-grade"). I stopped it and asked for simple, tutorial-style code a junior dev would write and could explain. The current code is the result.
- **Scope.** It had "import into an existing document" as well as "import as new". I cut it to one flow. I also chose viewer/editor roles over basic access, and decided against sign-up (seeded accounts make sharing faster for reviewers).
- **Hosting.** It set the project up for Render (Docker + Render Postgres). I switched to Vercel + Neon. It checked Vercel's current FastAPI docs before changing anything and adapted the app for serverless (entrypoint, build, safe seeding).
- **Database setup.** It wasn't allowed to create the Neon database on my account automatically, so I did that step myself in the Vercel dashboard and chose the free plan and region (US East, next to Vercel's default function region).
- **Feature ideas I pushed to "next".** I wanted image/video in docs and an AI summarize button. It pointed out that video uploads need paid storage (the brief says reviewers shouldn't pay) and that deployment wasn't done yet, so I shipped the core first. [TODO: update if you add any of these.]
- [TODO: add anything you changed after reading the code yourself.]

## How I verified it

- **Automated tests**: 11 pytest tests against the real app and a real database (no mocks of our own code).
- **Real browser run**: the Playwright script checked create → format → reload (formatting preserved) → share → Bob edits → Alice's stale save gets the conflict banner → Carol is read-only → import .md → reject .pdf → phone-width layout. No JavaScript errors.
- **Bugs found by verifying, not by trusting the output:**
  - SQLite returned timestamps without a timezone, so "Edited at" times would have been wrong by hours. Fixed.
  - The share dialog kept the last role selected, so the next person could get edit access by accident. Now it resets to "Can view".
  - On phones the sticky toolbar overlapped the header. Fixed.
  - The Neon integration defaults to a `STORAGE_` prefix, which would have created `STORAGE_URL`. The app reads `DATABASE_URL`, so I cleared the prefix.
  - `ajaia-docs.vercel.app` turned out to be someone else's app; our public URL is `ajaia-docs-ten-chi.vercel.app`. Easy to have submitted the wrong link.
  - Neon's connection string goes through a pooler (PgBouncer), so we turned off psycopg's automatic prepared statements, which can cause intermittent errors behind a pooler.
- **Tested the live deployment** with the same browser script (everything passed on Postgres), then deleted the test documents it created so reviewers start clean.
- **Review pass**: I had it review the code for performance and correctness. It found an N+1 query on the document list (one query per row), missing indexes, a race when two people share with the same user at the same time (would have been a 500 error), and that a default secret key could reach production. All fixed.
- **Reading the code**: [TODO: say honestly how you reviewed, e.g. "I read every backend file and the editor page; I asked it to explain the version check and the autosave queue until I could explain them myself."]
