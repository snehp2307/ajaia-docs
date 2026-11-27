import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from database import Base


def new_id():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=new_id)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")  # stored as sanitized HTML
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    # goes up by 1 on every save, so we can catch two people overwriting each other
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now)


class Share(Base):
    __tablename__ = "shares"
    __table_args__ = (UniqueConstraint("document_id", "user_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "viewer" or "editor"
