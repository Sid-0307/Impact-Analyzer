from fastapi.testclient import TestClient
from app.main import app, get_db

client = TestClient(app)


def fake_db_subscription():
    class DummyDB:
        def add(self, x): pass
        def commit(self): pass
        def refresh(self, x): pass
    return DummyDB()


# @patch("app.main.get_db", fake_db_subscription)
def test_subscribe():
    app.dependency_overrides[get_db] = fake_db_subscription

    payload = {
        "name": "repo",
        "mail": "user@example.com",
        "endpoints": ["/api/x"]
    }

    response = client.post("/api/subscribe", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    app.dependency_overrides.clear()