import sqlite3
import json
from config import settings
import google.generativeai as genai

GEMINI_API_KEY = settings.gemini_api_key

def fetch_repository_records():
    """
    Reads full records from the 'repositories' table.
    Expects columns: id, name, graph_json, (optionally others).

    :return: List of dictionaries representing records.
    """
    try:
        db_path = settings.database_url.split("sqlite:///")[-1]

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # Return rows as dict-like objects
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM repositories")
        rows = cursor.fetchall()

        conn.close()

        # Convert rows to normal dicts and decode JSON field
        records = []
        for row in rows:
            record = dict(row)
            if "graph_json" in record and record["graph_json"]:
                try:
                    record["graph_json"] = json.loads(record["graph_json"])
                except json.JSONDecodeError:
                    record["graph_json"] = None
            records.append(record)

        return records

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return []


def send_record_to_gemini(record: dict, user_prompt: str, api_key: str) -> str:
    """
    Sends a full repository record + a user-defined prompt to the Gemini LLM.

    :param record: Repository row as a dictionary.
    :param user_prompt: Instruction for the LLM.
    :param api_key: Gemini API key.
    :return: Response string from Gemini.
    """
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        payload = {
            "record": {k: v for k, v in record.items() if k != "graph_json"},
            "graph_json": record.get("graph_json")
        }

        llm_prompt = (
            f"{user_prompt}\n\n"
            "Here is the repository record:\n"
            f"{json.dumps(payload, indent=2)}"
        )

        response = model.generate_content(llm_prompt)
        return response.text

    except Exception as e:
        return f"Gemini LLM error: {e}"

def test_gemini_connection():
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content("Say 'Gemini connection successful.'")
        print("LLM Response:", response.text)

    except Exception as e:
        print("Connection / API Error:", e)


if __name__ == "__main__":

    CUSTOM_PROMPT = (
        "Analyze this repository record and dependency graph. To be extended later."
    )

#     genai.configure(api_key=GEMINI_API_KEY)
#     models = genai.list_models()
#
#     for m in models:
#         print(m.name, " | supports generateContent:", "generateContent" in m.supported_generation_methods)

    test_gemini_connection()

    try:
        records = fetch_repository_records()
    except Exception as e:
        print(f"Error fetching records: {e}")
        records = []


    for record in records:
        print(f"\n===== Repository ID: {record.get('id')} =====")
        response = send_record_to_gemini(record, CUSTOM_PROMPT, GEMINI_API_KEY)
        print(response)
        print("\n")
