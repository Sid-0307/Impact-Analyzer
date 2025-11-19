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

@app.post("/api/scan")
def store_scan(request: ScanRequest, db: Session = Depends(get_db)):
    try:
        repo_url = request.repo_url or ""
        name = repo_url.rstrip("/").split("/")[-1]
        if name.endswith(".git"):
            name = name[:-4]

        scan_details = ScanDetails(
            repo_url=request.repo_url,
            commit=request.commit,
            name=name,
            tag_name=request.tag_name,
            data=json.dumps(request.data)
        )
        db.add(scan_details)
        db.commit()
        return {"status": "ok"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


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