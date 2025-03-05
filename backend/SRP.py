from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import deque
import os

app = Flask(__name__)
CORS(app)

# Data Structures and Global Variables
class Node:
    def __init__(self, id: int, ip: int):
        self.id = id
        self.ip = ip
        self.visited = False
        self.inPath = False

# The graph (network) is a dictionary mapping Node objects to a list of neighbor Nodes.
network = {}
# A lookup dictionary to quickly get a node by its id.
node_lookup = {}

# Utility: Return a snapshot of the network state (nodes and edges)
def snapshot_network():
    nodes_list = []
    edges_list = []
    for node in network:
        nodes_list.append({
            "id": node.id,
            "ip": node.ip,
            "visited": node.visited,
            "inPath": node.inPath
        })
        # To avoid duplicate edges, add edge only if node.id < neighbor.id
        for neighbor in network[node]:
            if node.id < neighbor.id:
                edges_list.append({
                    "source": node.id,
                    "target": neighbor.id
                })
    return {"nodes": nodes_list, "edges": edges_list}

# Graph manipulation functions
def add_node(graph, id: int, ip: int):
    if id in node_lookup:
        # If node exists, you might update its IP or ignore.
        return
    node = Node(id, ip)
    graph[node] = []
    node_lookup[id] = node

def add_edge(graph, id1: int, id2: int):
    if id1 not in node_lookup or id2 not in node_lookup:
        return False
    node1 = node_lookup[id1]
    node2 = node_lookup[id2]
    # Ensure both nodes exist in the graph
    if node1 not in graph or node2 not in graph:
        return False
    if node2 not in graph[node1]:
        graph[node1].append(node2)
    if node1 not in graph[node2]:
        graph[node2].append(node1)
    return True

def remove_node(graph, id: int):
    if id not in node_lookup:
        return False
    node = node_lookup[id]
    # Remove node from all neighbor lists
    for neighbor in list(graph.get(node, [])):
        if node in graph[neighbor]:
            graph[neighbor].remove(node)
    if node in graph:
        del graph[node]
    del node_lookup[id]
    return True

def remove_edge(graph, id1: int, id2: int):
    if id1 not in node_lookup or id2 not in node_lookup:
        return False
    node1 = node_lookup[id1]
    node2 = node_lookup[id2]
    if node1 in graph and node2 in graph[node1]:
        graph[node1].remove(node2)
    if node2 in graph and node1 in graph[node2]:
        graph[node2].remove(node1)
    return True

def reset_nodes():
    for node in network:
        node.visited = False
        node.inPath = False

# Modified BFS that records a snapshot after each iteration.
def bfs_with_snapshots(graph, start, dest, direction):
    visited = set()
    queue = deque([(start, [start])])
    snapshots = []
    while queue:
        node, path = queue.popleft()
        # Record snapshot at each iteration
        snapshots.append(snapshot_network())
        if node.id == dest.id:
            for n in path:
                n.inPath = True
            snapshots.append(snapshot_network())
            return path, snapshots
        if node in visited:
            continue
        visited.add(node)
        node.visited = True
        for neighbor in graph.get(node, []):
            if neighbor.id == dest.id:
                new_path = path + [dest]
                for n in new_path:
                    n.inPath = True
                snapshots.append(snapshot_network())
                return new_path, snapshots
            if (direction == 'higher' and neighbor.ip > dest.ip) or \
               (direction == 'lower' and neighbor.ip < dest.ip):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
    return None, snapshots

# BFS wrapper that first tries one direction then the other.
def find_path_with_snapshots(graph, source, dest):
    reset_nodes()
    if source.id == dest.id:
        source.inPath = True
        return [source], [snapshot_network()]
    # Try the 'higher' direction first
    path, snapshots = bfs_with_snapshots(graph, source, dest, 'higher')
    if path:
        for n in path:
            n.inPath = True
        snapshots.append(snapshot_network())
        return path, snapshots
    # If no path was found, reset nodes and try 'lower' direction.
    reset_nodes()
    path, snapshots2 = bfs_with_snapshots(graph, source, dest, 'lower')
    snapshots.extend(snapshots2)
    if path:
        for n in path:
            n.inPath = True
        snapshots.append(snapshot_network())
        return path, snapshots
    return None, snapshots

# Flask Endpoints

# Get the current network snapshot.
@app.route('/network', methods=['GET'])
def get_network():
    return jsonify(snapshot_network())

# Add a node. Expects JSON {"id": int, "ip": int}.
@app.route('/node', methods=['POST'])
def create_node():
    data = request.get_json()
    node_id = data.get("id")
    ip = data.get("ip")
    if node_id is None or ip is None:
        return jsonify({"error": "id and ip required"}), 400
    add_node(network, node_id, ip)
    return jsonify(snapshot_network())

# Remove a node by its id.
@app.route('/node/<int:node_id>', methods=['DELETE'])
def delete_node(node_id):
    success = remove_node(network, node_id)
    if not success:
        return jsonify({"error": "node not found"}), 404
    return jsonify(snapshot_network())

# Add an edge between two nodes. Expects JSON {"source_id": int, "target_id": int}.
@app.route('/edge', methods=['POST'])
def create_edge():
    data = request.get_json()
    id1 = data.get("source_id")
    id2 = data.get("target_id")
    if id1 is None or id2 is None:
        return jsonify({"error": "source_id and target_id required"}), 400
    success = add_edge(network, id1, id2)
    if not success:
        return jsonify({"error": "one or both nodes not found"}), 404
    return jsonify(snapshot_network())

# Remove an edge between two nodes. Expects JSON {"source_id": int, "target_id": int}.
@app.route('/edge', methods=['DELETE'])
def delete_edge():
    data = request.get_json()
    id1 = data.get("source_id")
    id2 = data.get("target_id")
    if id1 is None or id2 is None:
        return jsonify({"error": "source_id and target_id required"}), 400
    success = remove_edge(network, id1, id2)
    if not success:
        return jsonify({"error": "one or both nodes not found"}), 404
    return jsonify(snapshot_network())

# Run BFS from a given source to destination.
# Expects JSON {"source_id": int, "dest_id": int} and returns the final path plus snapshots.
@app.route('/bfs', methods=['POST'])
def run_bfs():
    data = request.get_json()
    source_id = data.get("source_id")
    dest_id = data.get("dest_id")
    if source_id is None or dest_id is None:
        return jsonify({"error": "source_id and dest_id required"}), 400
    if source_id not in node_lookup or dest_id not in node_lookup:
        return jsonify({"error": "one or both nodes not found"}), 404
    source = node_lookup[source_id]
    dest = node_lookup[dest_id]
    path, snapshots = find_path_with_snapshots(network, source, dest)
    if path:
        path_result = [{"id": n.id, "ip": n.ip} for n in path]
        return jsonify({"path": path_result, "snapshots": snapshots})
    else:
        return jsonify({"error": "no path found", "snapshots": snapshots}), 404


@app.route('/reset', methods=['POST'])
def reset():
    reset_nodes()
    network.clear()
    node_lookup.clear()
    return jsonify(snapshot_network())


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
