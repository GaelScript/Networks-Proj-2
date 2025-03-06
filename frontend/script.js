const DEBUG = true;

const API_URL = 'https://networks-proj-2-production.up.railway.app';
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
const statusMessage = document.getElementById('status-message');

// Set canvas size
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Network state
let nodes = [];
let edges = [];

// Node visualization properties
const NODE_RADIUS = 30;
const COLORS = {
    DEFAULT: '#3498db',  // Blue
    VISITED: '#9b59b6',  // Purple
    PATH: '#e74c3c'      // Red
};

// Add debug logging function
function debugLog(...args) {
    if (DEBUG) {
        console.log('[Debug]', ...args);
    }
}

// Add function to test API endpoint
async function testEndpoint(endpoint, method = 'GET', body = null) {
    const url = `${API_URL}${endpoint}`;
    debugLog(`Testing endpoint: ${method} ${url}`);
    
    try {
        const options = {
            method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        debugLog(`Response status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            debugLog('Response data:', data);
            return { success: true, data };
        } else {
            const text = await response.text();
            debugLog('Error response:', text);
            return { success: false, error: text };
        }
    } catch (error) {
        debugLog('Fetch error:', error);
        return { success: false, error: error.message };
    }
}

// Update checkAPIAvailability to use testEndpoint
async function checkAPIAvailability() {
    debugLog('Checking API availability...');
    const result = await testEndpoint('/network');
    
    if (result.success) {
        showStatus('API is available');
        return true;
    } else {
        showStatus(`API is not available: ${result.error}`);
        return false;
    }
}

// Update fetchNetwork to use testEndpoint
async function fetchNetwork() {
    debugLog('Fetching network state...');
    const result = await testEndpoint('/network');
    
    if (result.success) {
        nodes = result.data.nodes || [];
        edges = result.data.edges || [];
        drawNetwork();
    } else {
        showStatus(`Failed to fetch network: ${result.error}`);
    }
}

// Drawing functions
function drawNetwork() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawEdges();
    drawNodes();
}

function drawEdges() {
    edges.forEach(edge => {
        const startNode = nodes.find(n => n.id === edge.source);
        const endNode = nodes.find(n => n.id === edge.target);
        if (startNode && endNode) {
            const start = getNodePosition(startNode.id, nodes.length);
            const end = getNodePosition(endNode.id, nodes.length);
            
            // Check if both nodes are in the path and are consecutive nodes
            const isInPath = startNode.inPath && endNode.inPath && areNodesConsecutiveInPath(startNode.id, endNode.id);
            
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            
            // Use red for path edges, default color for other edges
            ctx.strokeStyle = isInPath ? '#e74c3c' : '#2c3e50';
            ctx.lineWidth = isInPath ? 3 : 1; // Make path edges thicker
            ctx.stroke();
        }
    });
}

// Helper function to check if two nodes are consecutive in the path
function areNodesConsecutiveInPath(id1, id2) {
    // Get all nodes that are in the path
    const pathNodes = nodes.filter(n => n.inPath);
    
    // Sort them by ID to approximate the path order
    // This is a simplification and might not be 100% accurate for all path algorithms
    pathNodes.sort((a, b) => a.id - b.id);
    
    // Check if nodes appear consecutively in the path
    for (let i = 0; i < pathNodes.length - 1; i++) {
        if ((pathNodes[i].id === id1 && pathNodes[i + 1].id === id2) ||
            (pathNodes[i].id === id2 && pathNodes[i + 1].id === id1)) {
            return true;
        }
    }
    
    return false;
}

function drawNodes() {
    nodes.forEach(node => {
        const pos = getNodePosition(node.id, nodes.length);
        
        // Draw node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = node.inPath ? COLORS.PATH : 
                       node.visited ? COLORS.VISITED : 
                       COLORS.DEFAULT;
        ctx.fill();
        
        // Add a white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text with background for better readability
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 13px Arial';
        
        // Draw ID on top
        ctx.fillText(`ID: ${node.id}`, pos.x, pos.y - 8);
        
        // Draw IP below
        ctx.fillText(`IP: ${node.ip}`, pos.x, pos.y + 8);
    });
}

function getNodePosition(id, totalNodes) {
    // Ensure we have at least one node to avoid division by zero
    if (totalNodes === 0) return { x: canvas.width/2, y: canvas.height/2 };
    
    // Calculate angle based on node's index in the total set
    // Distribute nodes evenly around the circle regardless of their IDs
    const nodeIndex = nodes.findIndex(n => n.id === id);
    const angle = (nodeIndex * (2 * Math.PI / totalNodes));
    
    // Use a smaller radius when there are more nodes
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.35;
    // Adjust radius based on number of nodes to prevent overlap
    const radius = baseRadius * (1 - Math.min(totalNodes - 4, 20) * 0.02);
    
    return {
        x: canvas.width/2 + radius * Math.cos(angle),
        y: canvas.height/2 + radius * Math.sin(angle)
    };
}

// Update addNode to match server endpoint
async function addNode() {
    const id = prompt('Enter node ID (integer):');
    if (!id) return;
    
    const ip = prompt('Enter node IP (integer):');
    if (!ip) return;
    
    if (!Number.isInteger(Number(id)) || !Number.isInteger(Number(ip))) {
        showStatus('Both ID and IP must be integers');
        return;
    }

    debugLog(`Adding node with ID: ${id}, IP: ${ip}`);
    const result = await testEndpoint('/node', 'POST', {
        id: Number(id),
        ip: Number(ip)
    });
    
    if (result.success) {
        await fetchNetwork();
        showStatus('Node added successfully');
    } else {
        showStatus(`Failed to add node: ${result.error}`);
    }
}

async function removeNode() {
    const nodeId = prompt('Enter node ID to remove:');
    if (!nodeId) return;
    
    debugLog(`Removing node with ID: ${nodeId}`);
    const result = await testEndpoint(`/node/${nodeId}`, 'DELETE');
    
    if (result.success) {
        await fetchNetwork();
        showStatus('Node removed successfully');
    } else {
        showStatus(`Failed to remove node: ${result.error}`);
    }
}

async function addEdge() {
    const source = prompt('Enter source node ID:');
    const target = prompt('Enter target node ID:');
    if (!source || !target) return;

    debugLog(`Adding edge from ${source} to ${target}`);
    const result = await testEndpoint('/edge', 'POST', {
        source_id: Number(source),
        target_id: Number(target)
    });
    
    if (result.success) {
        await fetchNetwork();
        showStatus('Edge added successfully');
    } else {
        showStatus(`Failed to add edge: ${result.error}`);
    }
}

async function removeEdge() {
    const source = prompt('Enter source node ID:');
    const target = prompt('Enter target node ID:');
    if (!source || !target) return;

    debugLog(`Removing edge from ${source} to ${target}`);
    const result = await testEndpoint('/edge', 'DELETE', {
        source_id: Number(source),
        target_id: Number(target)
    });
    
    if (result.success) {
        await fetchNetwork();
        showStatus('Edge removed successfully');
    } else {
        showStatus(`Failed to remove edge: ${result.error}`);
    }
}

// Update resetNetwork to use testEndpoint
async function resetNetwork() {
    debugLog('Resetting network...');
    const result = await testEndpoint('/reset', 'POST');
    
    if (result.success) {
        await fetchNetwork();
        showStatus('Network reset successfully');
    } else {
        showStatus(`Failed to reset network: ${result.error}`);
    }
}

async function findPath() {
    const sourceId = document.getElementById('sourceNode').value;
    const destId = document.getElementById('destNode').value;
    
    if (!sourceId || !destId) {
        showStatus('Please enter both source and destination node IDs');
        return;
    }

    debugLog(`Finding path from ${sourceId} to ${destId}`);
    const result = await testEndpoint('/bfs', 'POST', {
        source_id: Number(sourceId),
        dest_id: Number(destId)
    });
    
    if (result.success) {
        showStatus('Path found!');
        await fetchNetwork(); // This will update the node colors based on visited/inPath
    } else {
        showStatus(result.error || 'No path found');
    }
}

function showStatus(message) {
    statusMessage.textContent = message;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

// Initialize with API check
window.onload = async function() {
    if (await checkAPIAvailability()) {
        await fetchNetwork();
    }
};

// Add random network generation function
async function generateRandomNetwork() {
    // First reset the network
    await resetNetwork();
    
    // Get number of nodes from input
    const nodeCount = parseInt(document.getElementById('nodeCount').value) || 5;
    if (nodeCount < 2) {
        showStatus('Please enter at least 2 nodes');
        return;
    }
    
    debugLog(`Generating random network with ${nodeCount} nodes`);
    showStatus(`Generating ${nodeCount} nodes...`);
    
    // Generate nodes with random IPs
    const generatedNodes = [];
    for (let i = 1; i <= nodeCount; i++) {
        // Generate random IP (1-255 for simplicity)
        const ip = Math.floor(Math.random() * 254) + 1;
        
        // Add node
        const result = await testEndpoint('/node', 'POST', {
            id: i,
            ip: ip
        });
        
        if (result.success) {
            generatedNodes.push({ id: i, ip: ip });
            debugLog(`Added node ${i} with IP ${ip}`);
        } else {
            showStatus(`Failed to add node ${i}: ${result.error}`);
            return;
        }
    }
    
    // Ensure network is connected (minimum spanning tree)
    // This guarantees all nodes are reachable
    showStatus(`Creating connected network...`);
    
    // First create a spanning tree to ensure connectivity
    for (let i = 1; i < nodeCount; i++) {
        // Connect each node to a random previous node
        const targetId = Math.floor(Math.random() * i) + 1;
        
        const result = await testEndpoint('/edge', 'POST', {
            source_id: i + 1,
            target_id: targetId
        });
        
        if (!result.success) {
            showStatus(`Failed to add edge ${i+1}-${targetId}: ${result.error}`);
            return;
        }
        
        debugLog(`Added edge from ${i+1} to ${targetId}`);
    }
    
    // Add some random additional edges for complexity
    const extraEdges = Math.floor(nodeCount * 0.5); // About 50% more edges
    showStatus(`Adding ${extraEdges} extra random edges...`);
    
    for (let i = 0; i < extraEdges; i++) {
        // Pick two random distinct nodes
        const sourceId = Math.floor(Math.random() * nodeCount) + 1;
        let targetId;
        do {
            targetId = Math.floor(Math.random() * nodeCount) + 1;
        } while (targetId === sourceId);
        
        // Try to add the edge - if it fails (already exists), that's fine
        const result = await testEndpoint('/edge', 'POST', {
            source_id: sourceId,
            target_id: targetId
        });
        
        if (result.success) {
            debugLog(`Added extra edge from ${sourceId} to ${targetId}`);
        }
    }
    
    // Refresh the display
    await fetchNetwork();
    showStatus(`Generated random network with ${nodeCount} nodes!`);
} 