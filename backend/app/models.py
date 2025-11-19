from sqlalchemy import Column, Integer, String, Text, DateTime,ForeignKey
from datetime import datetime
from database import Base
import json
from sqlalchemy.orm import relationship

class Repository(Base):
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True)
    url = Column(String, unique=True)
    name = Column(String)
    type = Column(String)  # 'backend' or 'frontend'
    graph_json = Column(Text)  # Store dependency graph as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @property
    def graph(self):
        return json.loads(self.graph_json) if self.graph_json else {}
    
    @graph.setter
    def graph(self, value):
        self.graph_json = json.dumps(value)


class PullRequest(Base):
    __tablename__ = "pull_requests"
    
    id = Column(Integer, primary_key=True)
    repo_url = Column(String)
    pr_number = Column(Integer)
    title = Column(String)
    author = Column(String)
    impact_json = Column(Text)  # Impact analysis results
    comment_url = Column(String)  # GitHub comment URL
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @property
    def impact(self):
        return json.loads(self.impact_json) if self.impact_json else {}
    
    @impact.setter
    def impact(self, value):
        self.impact_json = json.dumps(value)

class ScanDetails(Base):
    __tablename__ = "scan_details"
    
    id = Column(Integer, primary_key=True)
    repo_url = Column(String)
    name = Column(String)
    commit = Column(String)
    tag_name = Column(String)
    data = Column(Text)  # Store dependency graph as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def impact(self):
        return json.loads(self.impact_json) if self.impact_json else {}
    
    @impact.setter
    def impact(self, value):
        self.impact_json = json.dumps(value)
        
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    project_name = Column(String, index=True)
    email = Column(String, index=True)
    endpoints = Column(Text)  # JSON array stored as string
    created_at = Column(DateTime, default=datetime.utcnow)
