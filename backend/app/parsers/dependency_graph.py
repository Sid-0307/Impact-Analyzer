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
        for node in backend.get("nodes", []):
            node["repo"] = "backend"
            self.graph["nodes"].append(node)
        
        for node in frontend.get("nodes", []):
            node["repo"] = "frontend"
            self.graph["nodes"].append(node)
        
        for edge in backend.get("edges", []):
            edge["repo"] = "backend"
            self.graph["edges"].append(edge)
        
        for edge in frontend.get("edges", []):
            edge["repo"] = "frontend"
            self.graph["edges"].append(edge)
        
        self.graph["endpoints"] = backend.get("endpoints", [])
        
        self.graph["http_calls"] = frontend.get("http_calls", [])
    
    def _link_cross_repo(self):
        frontend_http_calls = []
        
        for node in self.graph["nodes"]:
            if node.get("repo") == "frontend":
                http_calls = [call for call in self.graph.get("http_calls", []) 
                             if call.get("source") == node["id"]]
                frontend_http_calls.extend(http_calls)
        
        for endpoint in self.graph["endpoints"]:
            backend_path = endpoint["path"]
            backend_method = endpoint["method"]
            
            for http_call in frontend_http_calls:
                if self._paths_match(backend_path, http_call["url"]) and \
                   backend_method == http_call["method"]:
                    
                    self.graph["edges"].append({
                        "from": http_call["source"],
                        "to": endpoint["handler"],
                        "type": "http_call",
                        "repo": "cross_repo",
                        "endpoint": backend_path
                    })
    
    def _paths_match(self, backend_path: str, frontend_url: str) -> bool:
        pattern = re.sub(r'\{[^}]+\}', r'[^/]+', backend_path)
        pattern = f"^{pattern}$"
        
        frontend_path = frontend_url.split('?')[0]
        
        return bool(re.match(pattern, frontend_path))
    
    def get_affected_nodes(self, changed_node_id: str) -> Set[str]:
        affected = set()
        queue = [changed_node_id]
        visited = set()
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            
            visited.add(current)
            affected.add(current)
            
            for edge in self.graph["edges"]:
                if edge["from"] == current and edge["to"] not in visited:
                    queue.append(edge["to"])
                elif edge["to"] == current and edge["from"] not in visited:
                    queue.append(edge["from"])
        
        return affected
    
    def get_node_info(self, node_id: str) -> Dict:
        for node in self.graph["nodes"]:
            if node["id"] == node_id:
                return node
        return None
    
    def to_dict(self) -> Dict:
        return self.graph