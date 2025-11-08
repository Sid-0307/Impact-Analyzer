from typing import Dict, List, Set
import re

class DependencyGraph:
    def __init__(self, backend_graph: Dict, frontend_graph: Dict):
        self.graph = {
            "nodes": [],
            "edges": [],
            "endpoints": []
        }
        self._merge_graphs(backend_graph, frontend_graph)
        self._link_cross_repo()
    
    def _merge_graphs(self, backend: Dict, frontend: Dict):
        """Merge backend and frontend graphs"""
        # Add all nodes
        for node in backend.get("nodes", []):
            node["repo"] = "backend"
            self.graph["nodes"].append(node)
        
        for node in frontend.get("nodes", []):
            node["repo"] = "frontend"
            self.graph["nodes"].append(node)
        
        # Add all edges
        for edge in backend.get("edges", []):
            edge["repo"] = "backend"
            self.graph["edges"].append(edge)
        
        for edge in frontend.get("edges", []):
            edge["repo"] = "frontend"
            self.graph["edges"].append(edge)
        
        # Store endpoints
        self.graph["endpoints"] = backend.get("endpoints", [])
        
        # Store HTTP calls from frontend (IMPORTANT for cross-linking)
        self.graph["http_calls"] = frontend.get("http_calls", [])
    
    def _link_cross_repo(self):
        """Link backend endpoints to frontend HTTP calls"""
        frontend_http_calls = []
        
        # Find all HTTP calls from frontend
        for node in self.graph["nodes"]:
            if node.get("repo") == "frontend":
                # Check if this node makes HTTP calls (stored in frontend graph)
                http_calls = [call for call in self.graph.get("http_calls", []) 
                             if call.get("source") == node["id"]]
                frontend_http_calls.extend(http_calls)
        
        # Match HTTP calls to backend endpoints
        for endpoint in self.graph["endpoints"]:
            backend_path = endpoint["path"]
            backend_method = endpoint["method"]
            
            for http_call in frontend_http_calls:
                if self._paths_match(backend_path, http_call["url"]) and \
                   backend_method == http_call["method"]:
                    
                    # Create cross-repo edge
                    self.graph["edges"].append({
                        "from": http_call["source"],
                        "to": endpoint["handler"],
                        "type": "http_call",
                        "repo": "cross_repo",
                        "endpoint": backend_path
                    })
    
    def _paths_match(self, backend_path: str, frontend_url: str) -> bool:
        """Match backend endpoint patterns to frontend URLs"""
        # Convert backend path params to regex: /users/{id} -> /users/[^/]+
        pattern = re.sub(r'\{[^}]+\}', r'[^/]+', backend_path)
        pattern = f"^{pattern}$"
        
        # Remove query params from frontend URL
        frontend_path = frontend_url.split('?')[0]
        
        return bool(re.match(pattern, frontend_path))
    
    def get_affected_nodes(self, changed_node_id: str) -> Set[str]:
        """BFS traversal to find all affected nodes"""
        affected = set()
        queue = [changed_node_id]
        visited = set()
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            
            visited.add(current)
            affected.add(current)
            
            # Find all nodes that depend on current node
            for edge in self.graph["edges"]:
                if edge["from"] == current and edge["to"] not in visited:
                    queue.append(edge["to"])
                # Also traverse backwards (who calls this node)
                elif edge["to"] == current and edge["from"] not in visited:
                    queue.append(edge["from"])
        
        return affected
    
    def get_node_info(self, node_id: str) -> Dict:
        """Get detailed info about a node"""
        for node in self.graph["nodes"]:
            if node["id"] == node_id:
                return node
        return None
    
    def to_dict(self) -> Dict:
        """Export graph as dictionary"""
        return self.graph