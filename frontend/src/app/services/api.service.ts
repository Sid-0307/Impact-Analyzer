import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Repository,
  PullRequest,
  DependencyGraph,
  OnboardRequest,
  OnboardResponse,
} from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  // Get all onboarded repositories
  getRepositories(): Observable<Repository[]> {
    return this.http.get<Repository[]>(`${this.baseUrl}/repos`);
  }

  // Get all analyzed PRs
  getPullRequests(): Observable<PullRequest[]> {
    return this.http.get<PullRequest[]>(`${this.baseUrl}/prs`);
  }

  // Get dependency graph for a specific repo
  getDependencyGraph(repoName: string): Observable<DependencyGraph> {
    return this.http.get<DependencyGraph>(`${this.baseUrl}/graph`, {
      params: { repo_name: repoName },
    });
  }

  // Onboard new repositories
  onboardRepositories(request: OnboardRequest): Observable<OnboardResponse> {
    return this.http.post<OnboardResponse>(`${this.baseUrl}/onboard`, request);
  }

  // Health check
  healthCheck(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>('http://localhost:8000/health');
  }
}
