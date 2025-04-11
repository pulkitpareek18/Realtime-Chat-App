import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Message {
    content: string;
    sender: 'user' | 'other';
    timestamp: Date;
}

const Chat = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [username, setUsername] = useState('');
    const [otherUsername, setOtherUsername] = useState('');
    const [connected, setConnected] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(true);
    const [tempUsername, setTempUsername] = useState('');
    const [tempOtherUsername, setTempOtherUsername] = useState('');
    const webSocketRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleUsernameSubmit = () => {
        if (tempUsername.trim() && tempOtherUsername.trim()) {
            setUsername(tempUsername);
            setOtherUsername(tempOtherUsername);
            setDialogOpen(false);
            initializeWebSocket(tempUsername, tempOtherUsername);
        }
    };

    const initializeWebSocket = (user: string, otherUser: string) => {
        try {
            console.log('Attempting to connect to WebSocket...');
            const ws = new WebSocket(import.meta.env.VITE_BACKEND_URL);
            webSocketRef.current = ws;

            // Connection opened
            ws.onopen = () => {
                console.log('WebSocket connected successfully');
                setConnected(true);
                
                // Register the user
                const registerMessage = JSON.stringify({
                    username: user,
                    register: true
                });
                console.log('Sending registration:', registerMessage);
                ws.send(registerMessage);
            };

            // Listen for messages
            ws.onmessage = (event) => {
                try {
                    console.log('Raw message received:', event.data);
                    
                    // Handle string responses
                    if (typeof event.data === 'string' && !event.data.startsWith('{')) {
                        console.log('String message received:', event.data);
                        return;
                    }
                    
                    const data = JSON.parse(event.data);
                    console.log('Parsed message:', data);
                    
                    // Check if it's a chat message
                    if (data.message !== undefined) {
                        const message: Message = {
                            content: data.message,
                            sender: 'other',
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, message]);
                    } 
                    // Check for successful registration
                    else if (data.type === 'registered' || event.data === 'Registered successfully') {
                        console.log('Registration successful');
                    } 
                    // Handle other message types
                    else {
                        console.log('Received other message type:', data);
                    }
                } catch (error) {
                    console.error('Error parsing message:', error, event.data);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnected(false);
            };

            ws.onclose = (event) => {
                console.log('WebSocket connection closed:', event.code, event.reason);
                setConnected(false);
            };

            return () => {
                console.log('Closing WebSocket connection...');
                ws.close();
            };
        } catch (error) {
            console.error('Failed to connect to WebSocket server:', error);
        }
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !webSocketRef.current) return;
        
        try {
            if (webSocketRef.current.readyState === WebSocket.OPEN) {
                // Create message object
                const messageObj = {
                    from: username,
                    to: otherUsername,
                    message: newMessage
                };
                
                console.log('Sending message:', messageObj);
                
                // Send to server
                webSocketRef.current.send(JSON.stringify(messageObj));
                
                // Add to local messages
                const message: Message = {
                    content: newMessage,
                    sender: 'user',
                    timestamp: new Date(),
                };
                
                setMessages(prev => [...prev, message]);
                setNewMessage('');
            } else {
                console.error('WebSocket is not open. Current state:', webSocketRef.current.readyState);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleDialogKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tempUsername && tempOtherUsername) {
            e.preventDefault();
            handleUsernameSubmit();
        }
    };

    return (
        <>
            {/* Username Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent onKeyDown={handleDialogKeyDown} className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">Start Chatting</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="username" className="text-right">
                                Your Name
                            </Label>
                            <Input
                                id="username"
                                autoFocus
                                placeholder="Enter your username"
                                value={tempUsername}
                                onChange={(e) => setTempUsername(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="otherUsername" className="text-right">
                                Chat With
                            </Label>
                            <Input
                                id="otherUsername"
                                placeholder="Enter recipient's username"
                                value={tempOtherUsername}
                                onChange={(e) => setTempOtherUsername(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            onClick={handleUsernameSubmit}
                            disabled={!tempUsername.trim() || !tempOtherUsername.trim()}
                            className="w-full"
                        >
                            Start Chat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chat UI */}
            <div className="flex h-screen">
                <div className="flex flex-col flex-1">
                    <div className="border-b p-4 flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Avatar>
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUsername}`} />
                                <AvatarFallback>{otherUsername.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{otherUsername}</p>
                            </div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-gray-100">
                            {connected ? 
                                <span className="text-green-600">● Connected (as {username})</span> : 
                                <span className="text-red-600">● Disconnected</span>
                            }
                        </div>
                    </div>

                    <Card className="flex-1 flex flex-col m-4 border-none shadow-none">
                        <CardHeader className="p-0"></CardHeader>
                        <CardContent className="flex-1 p-4 overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-4">
                                    {messages.length === 0 && (
                                        <div className="text-center text-gray-400 mt-8">
                                            No messages yet. Start a conversation!
                                        </div>
                                    )}
                                    {messages.map((message, index) => (
                                        <div 
                                            key={index}
                                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div 
                                                className={`rounded-lg p-3 max-w-[80%] ${
                                                    message.sender === 'user' 
                                                        ? 'bg-primary text-primary-foreground' 
                                                        : 'bg-muted'
                                                }`}
                                            >
                                                <p>{message.content}</p>
                                                <p className="text-xs text-right mt-1 opacity-70">
                                                    {new Intl.DateTimeFormat('en-US', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    }).format(message.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-2">
                            <div className="flex w-full items-center gap-2">
                                <Input
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="flex-1"
                                    disabled={!connected}
                                />
                                <Button 
                                    onClick={handleSendMessage} 
                                    disabled={!newMessage.trim() || !connected}
                                >
                                    Send
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default Chat;