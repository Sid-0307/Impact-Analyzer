from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app, get_db
from app.models import ScanDetails

client = TestClient(app)


def fake_db():
    """Return a fake SQLAlchemy session."""
    class DummyDB:
        def __init__(self):
            self.data = []

        def query(self, model):
            return self

        def filter(self, *args):
            return self

        def order_by(self, *args):
            return self

        def first(self):
            return None  # No previous scan

        def add(self, obj):
            self.data.append(obj)

        def commit(self):
            pass

    return DummyDB()



@patch("app.main.detect_changes", return_value="false <p>No changes detected</p>")
def test_scan_no_previous(mock_llm):
    app.dependency_overrides[get_db] = fake_db
    payload = {
        "repo_url": "https://github.com/test/repo",
        "commit": "abc123",
        "tag_name": "v1",
        "data": [{"method": "GET", "path": "/x"}]
    }

    response = client.post("/api/scan", json=payload)
    assert response.status_code == 200
    assert "Scan stored" in response.text
    app.dependency_overrides.clear()
