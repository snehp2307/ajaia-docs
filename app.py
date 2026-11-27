# Entry point for Vercel. Vercel looks for a FastAPI `app` in a root app.py,
# so this just adds backend/ to the import path and re-exports the real app.
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from main import app  # noqa: E402,F401
