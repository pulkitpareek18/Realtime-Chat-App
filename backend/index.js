import { WebSocketServer } from 'ws';

// Create a WebSocket server
const wss = new WebSocketServer({ port: 8080 });

// Store connected clients
const clients = new Map();

console.log('WebSocket server started on port 8080');

wss.on('connection', (ws) => {
    console.log('New client connected');
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
                
                console.log(`User ${username} registered`);
                
                // Send confirmation to the user
                ws.send(JSON.stringify({
                    type: 'registered',
                    success: true
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
                        message: 'Recipient not found'
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
});