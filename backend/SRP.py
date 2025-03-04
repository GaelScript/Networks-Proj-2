from collections import deque

class Node:
    def __init__(self, id: int, ip: int):
        self.id = id
        self.ip = ip
        self.visited = False
        self.inPath = False


def find_path(graph, source, dest):
    # Reset all nodes' inPath status to False before starting
    for node in graph:
        node.inPath = False
    
    if source == dest:
        source.inPath = True
        return [source]
    
    # Try higher direction first
    path = bfs(graph, source, dest, 'higher')
    if path:
        # Set inPath to True for all nodes in the path
        for node in path:
            node.inPath = True
        return path
    
    # Try lower direction if higher fails
    path = bfs(graph, source, dest, 'lower')
    if path:
        # Set inPath to True for all nodes in the path
        for node in path:
            node.inPath = True
    
    return path  # Will be None if no path is found

def bfs(graph, start, dest, direction):
    visited = set()
    queue = deque([(start, [start])])
    while queue:
        node, path = queue.popleft()
        if node.id == dest.id:
            return path
        if node in visited:
            continue
        visited.add(node)
        node.visited = True
        for neighbor in graph.get(node, []):
            if neighbor.id == dest.id:
                return path + [dest]
            if (direction == 'higher' and neighbor.ip > dest.ip) or \
               (direction == 'lower' and neighbor.ip < dest.ip):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
    return None

# Example usage:

node_1 = Node(1, 10)
node_2 = Node(2, 15)
node_3 = Node(3, 20)
node_4 = Node(4, 25)
node_5 = Node(5, 30)

network = {
    node_1: [node_2, node_3],
    node_2: [node_1, node_4],
    node_3: [node_1, node_5],
    node_4: [node_2, node_5],
    node_5: [node_3, node_4]
}

# Test the path finding
path = find_path(network, node_1, node_5)
if path:
    print("Path found:")
    print([node.ip for node in path])  # Print IPs for readability
    print("Nodes in path:", [node.id for node in network if node.inPath])
else:
    print("No path found")
