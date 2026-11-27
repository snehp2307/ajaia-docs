import os
import sys
import tempfile

import pytest

# point the app at a throwaway SQLite file BEFORE it gets imported.
# Set TEST_DATABASE_URL to run the same tests against Postgres instead.
db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite:///" + db_file)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from seed import DEMO_PASSWORD  # noqa: E402


def login_as(email):
    # each user gets their own client so they have their own session cookie
    client = TestClient(app)
    client.__enter__()  # runs the startup code (create tables + seed)
    res = client.post("/api/login", json={"email": email, "password": DEMO_PASSWORD})
    assert res.status_code == 200
    return client


@pytest.fixture
def alice():
    return login_as("alice@ajaia.test")


@pytest.fixture
def bob():
    return login_as("bob@ajaia.test")


@pytest.fixture
def carol():
    return login_as("carol@ajaia.test")
