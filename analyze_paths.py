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

def find_max_traversal_without_resources(graph, nodes, start_node="1", max_depth=100):
    """Find the maximum number of nodes that can be traversed without using life points or transport cards"""
    max_nodes = 0
    best_path = []
    
    def dfs(node, visited, path, depth=0):
        nonlocal max_nodes, best_path
        
        # Limit depth to prevent infinite loops
        if depth > max_depth:
            return
        
        # Update max if we found a longer path
        if len(path) > max_nodes:
            max_nodes = len(path)
            best_path = path.copy()
        
        # Explore all neighbors
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                # Check if this choice requires life points or transport cards
                requires_life = False
                requires_transport = False
                
                # Check the current node's choices to see if going to neighbor requires resources
                if node in nodes and 'choices' in nodes[node]:
                    for choice in nodes[node]['choices']:
                        if choice.get('nextNode') == neighbor:
                            # Check if choice has bonus that affects life points
                            bonus = choice.get('bonus', '')
                            if '减' in bonus and '生命值' in bonus:
                                requires_life = True
                            if '传送卡' in bonus:
                                requires_transport = True
                            break
                
                # Only proceed if we don't need to use resources
                if not requires_life and not requires_transport:
                    new_visited = visited | {node}
                    dfs(neighbor, new_visited, path + [neighbor], depth + 1)
    
    dfs(start_node, set(), [start_node])
    return max_nodes, best_path

def print_analysis(nodes, graph, start_node="1"):
    """Print the analysis results"""
    print("=== SSR结局最短路径分析 ===")
    print(f"起始节点: {start_node}")
    print()
    
    # Find SSR endings
    ssr_endings = find_ssr_endings(nodes)
    print(f"发现 {len(ssr_endings)} 个SSR结局:")
    for ending in ssr_endings:
        title = nodes[ending].get('title', 'Unknown')
        print(f"  - {ending}: {title}")
    print()
    
    # Find shortest paths
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
    
    # Find maximum traversal without resources
    print("=== 不使用生命值和传送卡的最大遍历 ===")
    max_nodes, best_path = find_max_traversal_without_resources(graph, nodes, start_node)
    print(f"最大可遍历节点数: {max_nodes}")
    print(f"路径: {' -> '.join(best_path)}")
    
    # Summary
    print("\n=== 总结 ===")
    reachable_ssr = [e for e in ssr_endings if shortest_distances[e] != float('inf')]
    if reachable_ssr:
        min_distance = min(shortest_distances[e] for e in reachable_ssr)
        min_ending = min(reachable_ssr, key=lambda e: shortest_distances[e])
        print(f"最短SSR路径: {min_ending} ({nodes[min_ending].get('title', 'Unknown')}) - {min_distance} 步")
    
    print(f"不使用资源的最大遍历: {max_nodes} 个节点")

def main():
    # Load story nodes
    nodes = load_story_nodes()
    
    # Build graph
    graph = build_graph(nodes)
    
    # Analyze paths
    print_analysis(nodes, graph)

if __name__ == "__main__":
    main() 