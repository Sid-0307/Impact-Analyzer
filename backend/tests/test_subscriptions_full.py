# tests/test_subscriptions_full.py
from fastapi.testclient import TestClient
from app.main import app, get_db

client = TestClient(app)

def fake_db_subscription():
    class DummyDB:
        def add(self, x): pass
        def commit(self): pass
        def refresh(self, x): pass
    return DummyDB()

class DummyDB:
    def __init__(self):
        self.added = None
    def query(self, model):
        class Q:
            def filter(self_inner, *a):
                return self_inner
            def first(self_inner):
                return None
        return Q()
    def add(self, x):
        self.added = x
    def commit(self): pass
    def refresh(self, x): pass


def test_subscribe_full_flow():
    app.dependency_overrides[get_db] = fake_db_subscription
    resp = client.post("/api/subscribe", json={
        "name": "repo",
        "mail": "user@example.com",
        "endpoints": ["/api/x"]
    })
    assert resp.status_code == 200
    app.dependency_overrides.clear()
