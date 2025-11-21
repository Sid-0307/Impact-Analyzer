from unittest.mock import patch
from app.main import getDiff, ScanDetails

def make_scan(commit, url="https://github.com/a/b"):
    s = ScanDetails()
    s.commit = commit
    s.repo_url = url
    s.name = "b"
    s.data = "[]"
    return s

@patch("app.main.requests.get")
def test_github_compare_success(mock_get):
    # First two calls are commit existence checks
    mock_get.side_effect = [
        # commit check 1
        type("Resp", (), {"status_code": 200, "text": "", "json": lambda: {}}),
        # commit check 2
        type("Resp", (), {"status_code": 200, "text": "", "json": lambda: {}}),
        # final compare call
        type("Resp", (), {"status_code": 200, "text": "diff-text", "json": lambda: {}}),
    ]

    old = make_scan("abc123")
    new = make_scan("def456")

    diff = getDiff(old, new)
    assert diff == "diff-text"
