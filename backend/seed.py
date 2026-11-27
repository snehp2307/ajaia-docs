from sqlalchemy.exc import IntegrityError

from auth import hash_password
from models import Document, Share, User

DEMO_PASSWORD = "demo1234"

DEMO_USERS = [
    ("alice@ajaia.test", "Alice Owner"),
    ("bob@ajaia.test", "Bob Teammate"),
    ("carol@ajaia.test", "Carol Reviewer"),
]


def seed(db):
    # only seed an empty database
    if db.query(User).count() > 0:
        return
    try:
        add_demo_data(db)
        db.commit()
    except IntegrityError:
        # On serverless hosting two instances can start at the same time and both
        # try to seed. The unique email column stops the second one, which is fine.
        db.rollback()


def add_demo_data(db):
    users = {}
    for email, name in DEMO_USERS:
        user = User(email=email, name=name, password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
        users[email] = user
    db.flush()

    welcome = Document(
        title="Welcome to Ajaia Docs",
        owner_id=users["alice@ajaia.test"].id,
        content=(
            "<h1>Welcome</h1>"
            "<p>This document is owned by <strong>Alice</strong> and shared with "
            "<em>Bob</em> as an editor and <u>Carol</u> as a viewer.</p>"
            "<ul><li>Try the toolbar</li><li>Open the Share dialog</li></ul>"
        ),
    )
    db.add(welcome)
    db.flush()
    db.add(Share(document_id=welcome.id, user_id=users["bob@ajaia.test"].id, role="editor"))
    db.add(Share(document_id=welcome.id, user_id=users["carol@ajaia.test"].id, role="viewer"))
