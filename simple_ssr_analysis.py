#!/usr/bin/env python3
import json
from collections import defaultdict, deque

def load_story_nodes():
    """Load the story nodes from the JSON file"""
    with open('story_nodes.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def build_graph(nodes):
    """Build a directed graph from the story nodes"""
    graph = defaultdict(list)
    
    for node_id, node_data in nodes.items():
        if 'choices' in node_data:
            for choice in node_data['choices']:
                if 'nextNode' in choice:
                    next_node = choice['nextNode']
                    graph[node_id].append(next_node)
    
    return graph

def find_ssr_endings(nodes):
    """Find all SSR endings"""
    ssr_endings = []
    for node_id, node_data in nodes.items():
        if node_data.get('specialEnding') == 'SSR':
            ssr_endings.append(node_id)
    return ssr_endings

def find_shortest_paths(graph, start_node, target_nodes):
    """Find shortest paths from start_node to all target nodes using BFS"""
    distances = {target: float('inf') for target in target_nodes}
    paths = {target: [] for target in target_nodes}
    
    # BFS to find shortest paths
    queue = deque([(start_node, 0, [start_node])])
    visited = set()
    
    while queue:
        current_node, distance, path = queue.popleft()
        
        if current_node in visited:
            continue
            
        visited.add(current_node)
        
        # Check if we reached a target
        if current_node in target_nodes:
            if distance < distances[current_node]:
                distances[current_node] = distance
                paths[current_node] = path.copy()
        
        # Explore neighbors
        for neighbor in graph.get(current_node, []):
            if neighbor not in visited:
                new_path = path + [neighbor]
                queue.append((neighbor, distance + 1, new_path))
    
    return distances, paths

def main():
    # Load story nodes
    nodes = load_story_nodes()
    
    # Build graph
    graph = build_graph(nodes)
    
    # Find SSR endings
    ssr_endings = find_ssr_endings(nodes)
    print(f"发现 {len(ssr_endings)} 个SSR结局:")
    for ending in ssr_endings:
        title = nodes[ending].get('title', 'Unknown')
        print(f"  - {ending}: {title}")
    print()
    
    # Find shortest paths
    start_node = "1"
    shortest_distances, shortest_paths = find_shortest_paths(graph, start_node, ssr_endings)
    
    print("最短路径到SSR结局:")
    for ending in ssr_endings:
        distance = shortest_distances[ending]
        path = shortest_paths[ending]
        title = nodes[ending].get('title', 'Unknown')
        
        if distance == float('inf'):
            print(f"❌ {ending} ({title}): 无法到达")
        else:
            print(f"✅ {ending} ({title}): {distance} 步")
            print(f"   路径: {' -> '.join(path)}")
        print()
    
    # Summary
    reachable_ssr = [e for e in ssr_endings if shortest_distances[e] != float('inf')]
    if reachable_ssr:
        min_distance = min(shortest_distances[e] for e in reachable_ssr)
        min_ending = min(reachable_ssr, key=lambda e: shortest_distances[e])
        print(f"最短SSR路径: {min_ending} ({nodes[min_ending].get('title', 'Unknown')}) - {min_distance} 步")

if __name__ == "__main__":
    main() 