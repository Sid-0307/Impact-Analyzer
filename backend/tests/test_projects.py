from fastapi.testclient import TestClient
from app.main import app, get_db

client = TestClient(app)


def fake_db_projects():
    class DummyScan:
        def __init__(self):
            self.name = "repo"
            self.repo_url = "https://github.com/a/b"

    class DummyDB:
        def query(self, model):
            class Q:
                def all(self_inner):
                    return [DummyScan()]
            return Q()

    yield DummyDB()


def test_get_projects():
    app.dependency_overrides[get_db] = fake_db_projects

    response = client.get("/api/projects")
    assert response.status_code == 200
    assert response.json() == {
        "projects": [{"name": "repo", "url": "https://github.com/a/b"}]
    }

    app.dependency_overrides.clear()
