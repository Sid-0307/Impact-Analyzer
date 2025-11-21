from app.main import extract_endpoints, diff_endpoints, parse_repo_url

def test_extract_endpoints():
    data = [
        {"Method": "get", "Path": "/users"},
        {"method": "post", "path": "/login"},
        {"method": None, "path": "/skip"},
    ]
    assert extract_endpoints(data) == ["GET /users", "POST /login"]


def test_diff_endpoints():
    old = [{"Method": "GET", "Path": "/a"}]
    new = [
        {"Method": "GET", "Path": "/a"},
        {"Method": "POST", "Path": "/b"},
    ]
    assert diff_endpoints(old, new) == ["POST /b"]


def test_parse_repo_url():
    owner, repo = parse_repo_url("https://github.com/a/b.git")
    assert owner == "a"
    assert repo == "b"

