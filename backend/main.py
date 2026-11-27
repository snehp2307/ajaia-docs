import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import timezone
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from auth import check_password, get_current_user
from database import DATABASE_URL, Base, SessionLocal, engine, get_db
from file_import import MAX_FILE_SIZE, clean_html, file_to_html
from models import Document, Share, User, now
from seed import seed

MAX_CONTENT_LENGTH = 500_000  # characters of HTML per document

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ajaia")

# The session cookie is signed with this key. A weak key in production would let
# anyone forge a login, so we refuse to start on Postgres without a real one.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if not DATABASE_URL.startswith("sqlite"):
        raise RuntimeError("SECRET_KEY must be set in production")
    SECRET_KEY = "dev-secret-only-for-local"


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed(db)
    db.close()
    yield


app = FastAPI(title="Ajaia Docs", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE") == "1",
    max_age=7 * 24 * 3600,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # one log line per API request with how long it took, so slow endpoints are easy to spot
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        ms = (time.perf_counter() - start) * 1000
        logger.info("%s %s -> %s in %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


# ---------- request bodies ----------

class LoginBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class CreateDocBody(BaseModel):
    title: str = Field(default="Untitled document", max_length=200)
    content: str = ""


class UpdateDocBody(BaseModel):
    version: int  # the version the client last loaded
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None


class ShareBody(BaseModel):
    email: str = Field(max_length=254)
    role: Literal["viewer", "editor"] = "viewer"


# ---------- helpers ----------

def user_json(user):
    return {"id": user.id, "email": user.email, "name": user.name}


def load_doc(db, doc_id, user, need="view"):
    """Loads a document and the user's role on it ('owner', 'editor' or 'viewer').
    `need` is the access the caller requires: 'view', 'edit' or 'owner'."""
    doc = db.get(Document, doc_id)
    role = None
    if doc and doc.owner_id == user.id:
        role = "owner"
    elif doc:
        share = db.query(Share).filter_by(document_id=doc.id, user_id=user.id).first()
        role = share.role if share else None

    # 404 instead of 403 so we don't reveal that the document exists
    if role is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if need == "edit" and role == "viewer":
        raise HTTPException(status_code=403, detail="You only have view access to this document")
    if need == "owner" and role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can do this")
    return doc, role


def doc_summary(doc, owner):
    updated = doc.updated_at
    # SQLite gives back dates without a timezone; we always store UTC
    if updated and updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return {
        "id": doc.id,
        "title": doc.title,
        "owner": user_json(owner),
        "updated_at": updated.isoformat() if updated else None,
    }


def doc_detail(db, doc, role):
    owner = db.get(User, doc.owner_id)
    data = doc_summary(doc, owner)
    data["content"] = doc.content
    data["version"] = doc.version
    data["role"] = role
    if role == "owner":
        # join users in the same query instead of one extra query per share
        rows = (
            db.query(Share, User)
            .join(User, User.id == Share.user_id)
            .filter(Share.document_id == doc.id)
            .order_by(User.name)
            .all()
        )
        data["shares"] = [{"user": user_json(u), "role": s.role} for s, u in rows]
    return data


def check_title(title):
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    return title


def check_content(content):
    if len(content) > MAX_CONTENT_LENGTH:
        raise HTTPException(status_code=413, detail="Document is too large")
    return clean_html(content)


async def read_upload(file):
    data = await file.read(MAX_FILE_SIZE + 1)  # never hold more than the limit in memory
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File is too big (max 2 MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    try:
        return file_to_html(file.filename, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- auth ----------

@app.post("/api/login")
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.strip().lower()).first()
    if not user or not check_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    request.session["user_id"] = user.id
    return user_json(user)


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user_json(user)


@app.get("/api/users")
def list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # used by the share dialog to suggest people
    others = db.query(User).filter(User.id != user.id).order_by(User.name).all()
    return [user_json(u) for u in others]


# ---------- documents ----------

@app.get("/api/documents")
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned = db.query(Document).filter_by(owner_id=user.id).order_by(Document.updated_at.desc()).all()
    # one query: the doc, my role on it, and its owner (avoids a query per row)
    shared_rows = (
        db.query(Document, Share.role, User)
        .join(Share, Share.document_id == Document.id)
        .join(User, User.id == Document.owner_id)
        .filter(Share.user_id == user.id)
        .order_by(Document.updated_at.desc())
        .all()
    )
    shared = [{**doc_summary(doc, owner), "role": role} for doc, role, owner in shared_rows]

    # how many people each of my documents is shared with (one grouped query)
    share_counts = dict(
        db.query(Share.document_id, func.count(Share.id))
        .filter(Share.document_id.in_([d.id for d in owned]))
        .group_by(Share.document_id)
        .all()
    )
    owned = [{**doc_summary(doc, user), "share_count": share_counts.get(doc.id, 0)} for doc in owned]
    return {"owned": owned, "shared": shared}


@app.post("/api/documents", status_code=201)
def create_document(body: CreateDocBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = Document(title=check_title(body.title), content=check_content(body.content), owner_id=user.id)
    db.add(doc)
    db.commit()
    return doc_detail(db, doc, "owner")


@app.post("/api/documents/import", status_code=201)
async def import_document(file: UploadFile = File(...), user: User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    content = await read_upload(file)
    title = os.path.splitext(file.filename)[0].strip()[:200] or "Imported document"
    doc = Document(title=title, content=content, owner_id=user.id)
    db.add(doc)
    db.commit()
    return doc_detail(db, doc, "owner")


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc, role = load_doc(db, doc_id, user)
    return doc_detail(db, doc, role)


@app.patch("/api/documents/{doc_id}")
def update_document(doc_id: str, body: UpdateDocBody, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    doc, role = load_doc(db, doc_id, user, need="edit")

    changes = {"version": body.version + 1, "updated_at": now()}
    if body.title is not None:
        changes["title"] = check_title(body.title)
    if body.content is not None:
        changes["content"] = check_content(body.content)

    # Only update if nobody else saved since this client loaded the doc.
    # Doing the version check inside the UPDATE makes it safe even if two saves arrive at once.
    updated = (
        db.query(Document)
        .filter(Document.id == doc_id, Document.version == body.version)
        .update(changes, synchronize_session=False)
    )
    db.commit()
    db.refresh(doc)
    if updated == 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "Someone else changed this document. Reload to see their changes.",
                    "current_version": doc.version},
        )
    return doc_detail(db, doc, role)


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc, role = load_doc(db, doc_id, user, need="owner")
    # delete shares explicitly: SQLite doesn't enforce ON DELETE CASCADE by default
    db.query(Share).filter_by(document_id=doc.id).delete()
    db.delete(doc)
    db.commit()
    return {"ok": True}


# ---------- sharing ----------

@app.post("/api/documents/{doc_id}/shares")
def share_document(doc_id: str, body: ShareBody, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    doc, role = load_doc(db, doc_id, user, need="owner")
    target = db.query(User).filter_by(email=body.email.strip().lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No user with that email")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You already own this document")

    share = db.query(Share).filter_by(document_id=doc.id, user_id=target.id).first()
    if share:
        share.role = body.role  # sharing again just changes the role
    else:
        db.add(Share(document_id=doc.id, user_id=target.id, role=body.role))
    try:
        db.commit()
    except IntegrityError:
        # someone shared with the same person at the same moment; just update the role
        db.rollback()
        db.query(Share).filter_by(document_id=doc.id, user_id=target.id).update({"role": body.role})
        db.commit()
    return doc_detail(db, doc, role)


@app.delete("/api/documents/{doc_id}/shares/{user_id}")
def remove_share(doc_id: str, user_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc, role = load_doc(db, doc_id, user, need="owner")
    db.query(Share).filter_by(document_id=doc.id, user_id=user_id).delete()
    db.commit()
    return doc_detail(db, doc, role)


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------- serve the built React app ----------

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

# Locally and in Docker, FastAPI serves the React app. On Vercel the CDN serves it from
# public/ (fast, cached, compressed); registering these routes there would send every
# page load through this Python function instead. Vercel sets the VERCEL env var.
if os.path.isdir(FRONTEND_DIR) and not os.getenv("VERCEL"):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
