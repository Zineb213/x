// sockets/index.js
const socketIO = require('socket.io');
const authenticateSocket = require('./auth');
const EVENTS = require('./events');
const { handleSendMessage, handleMarkRead, handleTypingStart, handleTypingEnd } = require('./handlers/messageHandler');
const { handleUserOnline, handleUserOffline } = require('./handlers/presenceHandler');
const { handleJoinLevelRoom, handleJoinConversation, handleLeaveConversation } = require('./handlers/roomHandler');

let io;

const initSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    
    // Authentication middleware
    io.use(authenticateSocket);
    
    io.on(EVENTS.CONNECTION, (socket) => {
        console.log(`New client connected: ${socket.id}`);
        
        // Handle user online
        handleUserOnline(io, socket);
        
        // Room handlers
        socket.on(EVENTS.JOIN_LEVEL_ROOM, (data) => handleJoinLevelRoom(io, socket, data));
        socket.on(EVENTS.JOIN_CONVERSATION, (data) => handleJoinConversation(io, socket, data));
        socket.on(EVENTS.LEAVE_CONVERSATION, (data) => handleLeaveConversation(io, socket, data));
        
        // Message handlers
        socket.on(EVENTS.SEND_MESSAGE, (data) => handleSendMessage(io, socket, data));
        socket.on(EVENTS.MARK_READ, (data) => handleMarkRead(io, socket, data));
        socket.on(EVENTS.TYPING_START, (data) => handleTypingStart(io, socket, data));
        socket.on(EVENTS.TYPING_END, (data) => handleTypingEnd(io, socket, data));
        
        // Disconnect
        socket.on(EVENTS.DISCONNECT, () => {
            handleUserOffline(io, socket);
            console.log(`Client disconnected: ${socket.id}`);
        });
    });
    
    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = { initSocket, getIO };
