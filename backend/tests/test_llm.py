from unittest.mock import patch
from app.main import detect_changes


@patch("app.main.genai.GenerativeModel")
@patch("app.main.getDiff", return_value="dummy diff")
def test_llm(mock_diff, mock_model):
    mock_model.return_value.generate_content.return_value.text = "true <p>Changed</p>"

    class DummyScan:
        repo_url = "url"
        commit = "abc"
        data = "[]"

    old_scan = DummyScan()
    new_scan = DummyScan()

    result = detect_changes(old_scan, new_scan, "TEST PROMPT", "XYZ")
    assert result.startswith("true")
