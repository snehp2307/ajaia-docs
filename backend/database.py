import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Local dev uses a SQLite file. On Render we set DATABASE_URL to Postgres.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# Render gives "postgres://..." but SQLAlchemy needs the driver name
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # pool_pre_ping: check a connection is still alive before using it (serverless
    # instances can sit idle). prepare_threshold=None: Neon's URL goes through a
    # connection pooler (PgBouncer), which doesn't mix well with prepared statements.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"prepare_threshold": None})

SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
