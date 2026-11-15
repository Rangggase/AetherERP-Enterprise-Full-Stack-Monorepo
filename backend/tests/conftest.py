import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PO_APPROVAL_THRESHOLD"] = "50000000"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "100000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core import database
from app.core.database import Base, get_db, make_engine
from app.main import app
from app.seed import seed_reference, seed_users

PASSWORD = "Test#Pass123"


@pytest.fixture()
def engine():
    eng = make_engine("sqlite://")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def Session(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db(Session):
    with Session() as s:
        seed_reference(s)
        seed_users(s, PASSWORD)
        s.commit()
        yield s


@pytest.fixture()
def client(Session, db):
    def override():
        with Session() as s:
            yield s

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client, email: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

