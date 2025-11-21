from fastapi import FastAPI, Depends, HTTPException, Request,Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json
import traceback
from pathlib import Path
from .database import get_db, init_db
from .models import Repository, PullRequest, ScanDetails,Subscription
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from .config import settings
import google.generativeai as genai
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import requests
from urllib.parse import urlparse
import yaml
from pathlib import Path

PROMPT_FILE = Path(__file__).parent / "prompts" / "llm_prompt.yaml"

with open(PROMPT_FILE, "r") as f:
    prompt_data = yaml.safe_load(f)
CUSTOM_PROMPT = prompt_data["custom_prompt"]

SMTP_EMAIL = settings.smtp_email
SMTP_PASSWORD = settings.smtp_password
GEMINI_API_KEY = settings.gemini_api_key
GITHUB_TOKEN = settings.github_token

app = FastAPI(title="Impact Analyzer API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
@app.on_event("startup")
def startup():
    init_db()


class OnboardRequest(BaseModel):
    backend_repo_url: str
    frontend_repo_url: str

class WebhookPayload(BaseModel):
    action: str
    number: int
    pull_request: dict
    repository: dict

class ScanRequest(BaseModel):
    repo_url: str
    commit: str
    tag_name: str
    data: List[dict]
    
class SubscribeRequest(BaseModel):
    name:str
    mail:str
    endpoints:List[str]

@app.get("/health")
def health_check():
    return {"status": "ok"}

def send_email(to, subject, html_body):
    server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
    server.login(SMTP_EMAIL, SMTP_PASSWORD)

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_EMAIL
    msg["To"] = to
    msg["Subject"] = subject

    html_part = MIMEText(html_body, "html", "utf-8")
    msg.attach(html_part)

    server.sendmail(SMTP_EMAIL, to, msg.as_string())
    server.quit()


# helpers

def extract_endpoints(scan_data):
    """Convert scan item into a consistent endpoint string."""
    endpoints = []
    for item in scan_data:
        method = item.get("Method") or item.get("method")
        path = item.get("Path") or item.get("path")
        if method and path:
            endpoints.append(f"{method.upper()} {path}")
    return endpoints



def diff_endpoints(old_scan, new_scan):
    """Returns the list of endpoints that changed."""
    old_eps = set(extract_endpoints(old_scan))
    new_eps = set(extract_endpoints(new_scan))

    changed = new_eps - old_eps
    return list(changed)



def parse_repo_url(repo_url):
    path = urlparse(repo_url).path.strip("/")
    owner, repo = path.split("/", 1)

    # remove .git suffix if present
    if repo.endswith(".git"):
        repo = repo[:-4]

    return owner, repo


def getDiff(old_scan, new_scan):
    owner, repo = parse_repo_url(old_scan.repo_url)
    base = old_scan.commit
    head = new_scan.commit

    print("Comparing commits:")
    print("Owner:", owner)
    print("Repo:", repo)
    print("Base:", base)
    print("Head:", head)

    # sanity check first
    for sha in [base, head]:
        commit_check = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
        r = requests.get(commit_check, headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}"
        })
        print("Check commit:", sha, r.status_code)
        if r.status_code != 200:
            raise Exception(f"Commit {sha} does not exist on GitHub.")

    # now compare
    url = f"https://api.github.com/repos/{owner}/{repo}/compare/{base}...{head}"
    headers = {
        "Accept": "application/vnd.github.v3.diff",
        "Authorization": f"Bearer {GITHUB_TOKEN}"
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"GitHub API error {response.status_code}: {response.text}")

    return response.text




def detect_changes(old_scan, new_scan, user_prompt: str, api_key: str) -> str:
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

        old_data = json.loads(old_scan.data)
        new_data = json.loads(new_scan.data)

        diff = getDiff(old_scan, new_scan)

        print("diff: ",diff)

        payload = {
            "record": {
                "old": old_data,
                "new": new_data,
                "git_diff": diff
            }
        }

        llm_prompt = (
            f"{user_prompt}\n\n"
            f"{json.dumps(payload, indent=2)}"
        )

        response = model.generate_content(llm_prompt)
        print(response.text)
        return response.text

    except Exception as e:
        return f"Gemini LLM error: {e}"


def notify_subscribers(db, repo_name, llm_response):
    print("notify_subscribers called for:", repo_name)

    subs = db.query(Subscription).filter(Subscription.project_name == repo_name).all()
    print("subs:", subs)



    for sub in subs:
        try:
            print(f"Sending to {sub.email}...")
            send_email(
                to=sub.email,
                subject=f"Changes detected in {repo_name}",
                html_body=llm_response
            )

            print("Email sent to:", sub.email)

        except Exception as e:
            print("EMAIL FAILED:", e)


# api routes

@app.post("/api/scan")
def store_scan(request: ScanRequest, db: Session = Depends(get_db)):
    try:
        repo_url = request.repo_url or ""
        name = repo_url.rstrip("/").split("/")[-1]
        if name.endswith(".git"):
            name = name[:-4]

        # ---- Fetch previous scan ----
        previous_scan = (
            db.query(ScanDetails)
            .filter(ScanDetails.name == name)
            .order_by(ScanDetails.created_at.desc())
            .first()
        )

        # ---- Save new scan ----
        scan_details = ScanDetails(
            repo_url=request.repo_url,
            commit=request.commit,
            name=name,
            tag_name=request.tag_name,
            data=json.dumps(request.data)
        )
        print(scan_details.repo_url, scan_details.commit, scan_details.name, scan_details.tag_name, scan_details.data)
        db.add(scan_details)
        db.commit()

        response = {"message": "Scan stored. No previous scan to compare."}

        # ---- Compare with previous & detect changes ----
        if previous_scan:
            old_data = json.loads(previous_scan.data)
            new_data = request.data

            llm_response = detect_changes(previous_scan, scan_details, CUSTOM_PROMPT, GEMINI_API_KEY)

            first_space = llm_response.find(" ")
            flag_text = llm_response[:first_space]
            html_body = llm_response[first_space+1:]

            changed_bool = flag_text.strip().lower().startswith("true")

            response = llm_response

            if changed_bool:
                print("There were changes..sending mail")
                try:
                    notify_subscribers(db, name, html_body)
                except Exception as e:
                    print("Notification error:", e)
                    response = f"Notification error: {e}"

        return "ok" 

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Scan failed: {str(e)}")





@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db)):
    try:
        scans = db.query(ScanDetails).all()

        projects = {}
        for scan in scans:
            if scan.name:
                projects[scan.name] = scan.repo_url

        result = [{"name": name, "url": url} for name, url in projects.items()]

        return {"projects": result}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch projects: {str(e)}"
        )

@app.get("/api/projects/{project_name}")
def get_project_details(project_name: str, db: Session = Depends(get_db)):
    try:
        scans = (
            db.query(ScanDetails)
            .filter(ScanDetails.name == project_name)
            .order_by(ScanDetails.created_at.desc())
            .all()
        )

        if not scans:
            raise HTTPException(status_code=404, detail="Project not found")

        repo_url = scans[0].repo_url

        result = {
            "name": project_name,
            "url": repo_url,
            "scans": []
        }

        for scan in scans:
            result["scans"].append({
                "id": scan.id,
                "commit": scan.commit,
                "tag_name": scan.tag_name,
                "created_at": scan.created_at,
                "data": json.loads(scan.data or "[]")
            })

        return result

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch project details: {str(e)}"
        )


@app.post("/api/subscribe")
def subscribeEndpoints(request: SubscribeRequest, db: Session = Depends(get_db)):
    try:
        sub = Subscription(
            project_name=request.name,
            email=request.mail,
            endpoints=json.dumps(request.endpoints)
        )
        
        db.add(sub)
        db.commit()
        db.refresh(sub)

        print("Subscription saved:", sub.id)

        return {"status": "ok",}
    
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Subscription failed: {str(e)}"
        )
        
@app.get("/api/subscriptions")
def get_subscriptions(
    project_name: str = Query(None),
    email: str = Query(None),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Subscription)

        if project_name:
            query = query.filter(Subscription.project_name == project_name)
        if email:
            query = query.filter(Subscription.email == email)

        subs = query.order_by(Subscription.created_at.desc()).all()

        result = []
        for sub in subs:
            result.append({
                "id": sub.id,
                "project_name": sub.project_name,
                "email": sub.email,
                "endpoints": json.loads(sub.endpoints),
                "created_at": sub.created_at
            })

        return {"subscriptions": result}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch subscriptions: {str(e)}"
        )





@app.get('/api/test-gemini-connection')
def test_gemini_connection():
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content("Say 'Gemini connection successful.'")
        print("LLM Response:", response.text)
        return {"message": response.text}

    except Exception as e:
        print("Connection / API Error:", e)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
