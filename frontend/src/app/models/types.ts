export interface Repository {
  id: number;
  name: string;
  url: string;
  type: 'backend' | 'frontend';
  created_at: string;
}

export interface PullRequest {
  id: number;
  repo_url: string;
  pr_number: number;
  title: string;
  author: string;
  impact: ImpactAnalysis;
  comment_url: string;
  created_at: string;
}

export interface ImpactAnalysis {
  changed_files: ChangedFile[];
  affected_backend: AffectedNode[];
  affected_frontend: AffectedNode[];
  affected_tests: AffectedNode[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ChangedFile {
  file: string;
  node: string;
}

export interface AffectedNode {
  id: string;
  type: string;
  file: string;
  repo?: string;
  endpoint?: {
    path: string;
    method: string;
    handler: string;
  };
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  endpoints?: Endpoint[];
}

export interface GraphNode {
  id: string;
  type: string;
  file: string;
  repo?: string;
  endpoint?: {
    path: string;
    method: string;
  };
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'calls' | 'tests' | 'http_call';
  repo?: string;
  endpoint?: string;
}

export interface Endpoint {
  path: string;
  method: string;
  handler: string;
}

export interface OnboardRequest {
  backend_repo_url: string;
  frontend_repo_url: string;
}

export interface OnboardResponse {
  status: string;
  message: string;
  backend_repo: string;
  frontend_repo: string;
  total_nodes: number;
  total_edges: number;
  endpoints: number;
}
