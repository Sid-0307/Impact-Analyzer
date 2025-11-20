from fastapi import FastAPI, Depends, HTTPException, Request,Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json
import traceback
from pathlib import Path
from database import get_db, init_db
from models import Repository, PullRequest, ScanDetails,Subscription
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import os



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

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")



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

def send_email(to_email: str, subject: str, body: str):
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        server.quit()

        print(f"Email sent to {to_email}")

    except Exception as e:
        print("Email sending failed:", str(e))

# helpers

def extract_endpoints(scan_data):
    """Extract endpoint strings from scan data."""
    return [item.get("endpoint") for item in scan_data if "endpoint" in item]


def diff_endpoints(old_scan, new_scan):
    """Returns the list of endpoints that changed."""
    old_eps = set(extract_endpoints(old_scan))
    new_eps = set(extract_endpoints(new_scan))

    changed = new_eps - old_eps
    return list(changed)

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
        db.add(scan_details)
        db.commit()

        # ---- Compare with previous & detect changes ----
        if previous_scan:
            old_data = json.loads(previous_scan.data)
            new_data = request.data

            changed_endpoints = diff_endpoints(old_data, new_data)

            if changed_endpoints:
                print("Changed endpoints:", changed_endpoints)

                # Notify subscribers
                notify_subscribers(db, name, changed_endpoints)

        return {"status": "ok"}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Scan failed: {str(e)}")


def notify_subscribers(db: Session, project_name: str, changed_eps: List[str]):
    """Find subscribers and send emails about changed endpoints."""
    try:
        subs = (
            db.query(Subscription)
            .filter(Subscription.project_name == project_name)
            .all()
        )

        for sub in subs:
            subscribed_eps = json.loads(sub.endpoints)

            # Find which of the changed endpoints this user cares about
            hits = [ep for ep in changed_eps if ep in subscribed_eps]

            if hits:
                body = f"""
                <h3>Changes detected in {project_name}</h3>
                <p>The following endpoints you subscribed to have changed:</p>
                <ul>
                    {''.join(f'<li>{ep}</li>' for ep in hits)}
                </ul>
                """

                send_email(
                    to_email=sub.email,
                    subject=f"🚨 API Changes in {project_name}",
                    body=body
                )

    except Exception as e:
        print("Subscriber notification failed:", str(e))


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