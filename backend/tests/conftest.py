import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import config
from backend.app.database import Base, get_session
from backend.app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("RESPONDER_API_TOKEN", "test-responder-token")
    monkeypatch.setenv("ADMIN_API_TOKEN", "test-admin-token")
    config.get_settings.cache_clear()
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(engine)

    def override_session():
        with TestSession() as db:
            yield db

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
    config.get_settings.cache_clear()


@pytest.fixture
def report_payload():
    return {
        "id": "CL-TEST-001",
        "categories": ["Rescue", "Medical"],
        "description": "A trapped adult with a cardiac condition needs help.",
        "location_text": "Example Road, Demonstration City",
        "urgency": "Critical",
        "contact_primary": "+1 555 0100",
        "client_sync_status": "queued",
    }


@pytest.fixture
def responder_headers():
    return {"Authorization": "Bearer test-responder-token"}
