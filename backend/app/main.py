from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import json

from database import get_db, init_db
from models import Repository, PullRequest
from parsers.java_parser import JavaParser
from parsers.ts_parser import TypeScriptParser
from parsers.dependency_graph import DependencyGraph
from services.github_service import GitHubService
from services.impact_analyzer import ImpactAnalyzer
from utils import clone_or_pull_repo, extract_repo_full_name

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

github_service = GitHubService()

# ==================== SCHEMAS ====================

class OnboardRequest(BaseModel):
    backend_repo_url: str
    frontend_repo_url: str

class WebhookPayload(BaseModel):
    action: str
    number: int
    pull_request: dict
    repository: dict

# ==================== ROUTES ====================

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/onboard")
def onboard_repos(request: OnboardRequest, db: Session = Depends(get_db)):
    """Onboard both repos and build dependency graph"""
    
    try:
        # 1. Clone/pull repos
        backend_path = clone_or_pull_repo(request.backend_repo_url)
        frontend_path = clone_or_pull_repo(request.frontend_repo_url)
        
        # 2. Parse backend (Java)
        java_parser = JavaParser(str(backend_path))
        backend_graph = java_parser.parse()
        
        # 3. Parse frontend (TypeScript)
        ts_parser = TypeScriptParser(str(frontend_path))
        frontend_graph = ts_parser.parse()
        
        # 4. Build combined dependency graph
        combined_graph = DependencyGraph(backend_graph, frontend_graph)
        graph_dict = combined_graph.to_dict()
        
        # 5. Save to database
        backend_repo = Repository(
            url=request.backend_repo_url,
            name=extract_repo_full_name(request.backend_repo_url),
            type="backend",
            graph_json=json.dumps(backend_graph)
        )
        
        frontend_repo = Repository(
            url=request.frontend_repo_url,
            name=extract_repo_full_name(request.frontend_repo_url),
            type="frontend",
            graph_json=json.dumps(frontend_graph)
        )
        
        db.add(backend_repo)
        db.add(frontend_repo)
        db.commit()
        
        # 6. Create webhooks (optional for local dev)
        # webhook_url = "http://your-server.com/api/webhook"
        # github_service.create_webhook(backend_repo.name, webhook_url)
        # github_service.create_webhook(frontend_repo.name, webhook_url)
        
        return {
            "status": "success",
            "message": "Repositories onboarded successfully",
            "backend_repo": backend_repo.name,
            "frontend_repo": frontend_repo.name,
            "total_nodes": len(graph_dict["nodes"]),
            "total_edges": len(graph_dict["edges"]),
            "endpoints": len(graph_dict.get("endpoints", []))
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Onboarding failed: {str(e)}")

@app.post("/api/webhook")
async def handle_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle GitHub PR webhook events"""
    
    try:
        payload = await request.json()
        
        # Only process opened/synchronize events
        if payload.get("action") not in ["opened", "synchronize"]:
            return {"status": "ignored"}
        
        pr_data = payload["pull_request"]
        repo_data = payload["repository"]
        
        repo_full_name = repo_data["full_name"]
        pr_number = pr_data["number"]
        
        # 1. Find repo in database
        repo = db.query(Repository).filter(
            Repository.name == repo_full_name
        ).first()
        
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not onboarded")
        
        # 2. Get PR diff
        changed_files = github_service.get_pr_diff(repo_full_name, pr_number)
        
        # 3. Load dependency graph
        graph = json.loads(repo.graph_json)
        
        # 4. Analyze impact
        analyzer = ImpactAnalyzer(graph)
        impact = analyzer.analyze_pr_impact(changed_files)
        
        # 5. Generate comment
        comment_body = analyzer.generate_comment(impact)
        
        # 6. Post comment to PR
        comment_url = github_service.post_comment(repo_full_name, pr_number, comment_body)
        
        # 7. Save PR to database
        pr_record = PullRequest(
            repo_url=repo.url,
            pr_number=pr_number,
            title=pr_data["title"],
            author=pr_data["user"]["login"],
            impact_json=json.dumps(impact),
            comment_url=comment_url
        )
        
        db.add(pr_record)
        db.commit()
        
        return {
            "status": "success",
            "pr_number": pr_number,
            "impact_level": impact["risk_level"],
            "comment_url": comment_url
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@app.get("/api/repos")
def get_all_repos(db: Session = Depends(get_db)):
    """Get all onboarded repositories"""
    repos = db.query(Repository).order_by(Repository.created_at.desc()).all()

    return [
        {
            "id": repo.id,
            "name": repo.name,
            "url": repo.url,
            "type": repo.type,
            "created_at": repo.created_at.isoformat() if hasattr(repo, "created_at") else None
        }
        for repo in repos
    ]


@app.get("/api/prs")
def get_all_prs(db: Session = Depends(get_db)):
    """Get all analyzed PRs"""
    prs = db.query(PullRequest).order_by(PullRequest.created_at.desc()).all()
    
    return [{
        "id": pr.id,
        "repo_url": pr.repo_url,
        "pr_number": pr.pr_number,
        "title": pr.title,
        "author": pr.author,
        "impact": pr.impact,
        "comment_url": pr.comment_url,
        "created_at": pr.created_at.isoformat()
    } for pr in prs]

@app.get("/api/graph")
def get_dependency_graph(repo_name: str, db: Session = Depends(get_db)):
    """Get dependency graph for a repo"""
    repo = db.query(Repository).filter(Repository.name == repo_name).first()
    
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    return repo.graph

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)