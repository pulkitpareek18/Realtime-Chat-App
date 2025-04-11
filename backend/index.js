import { WebSocketServer } from 'ws';
import http from 'http';
import { createRequire } from 'module';

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Respond with 200 OK
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running');
});

// Create WebSocket server on top of HTTP server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map();

// Connection handler
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`New client connected from ${ip}`);
    let username = null;

    ws.on('message', (data) => {
        try {
            // Parse the incoming message
            const message = JSON.parse(data);
            console.log('Received message:', message);

            // Handle user registration
            if (message.register && message.username) {
                // Check if username is already in use
                if (clients.has(message.username)) {
                    console.log(`Username ${message.username} is already in use`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Username already in use'
                    }));
                    return;
                }

                // Set username and store the connection
                username = message.username;
                clients.set(username, ws);
                
                console.log(`User ${username} registered (${clients.size} users online)`);
                
                // Send confirmation to the user
                ws.send(JSON.stringify({
                    type: 'registered',
                    success: true,
                    username: username,
                    onlineCount: clients.size
                }));
                
                return;
            }

            // Handle private messages
            if (message.message && message.to) {
                // Get the intended recipient's connection
                const recipient = clients.get(message.to);
                
                // Make sure sender is registered
                if (!username) {
                    console.log('Unregistered user attempting to send message');
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Please register first'
                    }));
                    return;
                }
                
                // Verify we have the recipient
                if (!recipient) {
                    console.log(`Recipient ${message.to} not found`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Recipient not found or offline'
                    }));
                    return;
                }
                
                // Forward the message to recipient
                console.log(`Forwarding message from ${username} to ${message.to}`);
                recipient.send(JSON.stringify({
                    from: username,
                    message: message.message,
                    timestamp: new Date().toISOString()
                }));
                
                // Send delivery confirmation to sender
                ws.send(JSON.stringify({
                    type: 'delivered',
                    to: message.to,
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        if (username) {
            console.log(`User ${username} disconnected`);
            clients.delete(username);
        } else {
            console.log('Unregistered client disconnected');
        }
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (username) {
            clients.delete(username);
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`WebSocket server started on port ${PORT}`);
    console.log(`HTTP endpoint available at http://localhost:${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.clients.forEach(client => {
        client.close();
    });
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});