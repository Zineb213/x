// sockets/handlers/roomHandler.js
const Conversation = require('../../models/Conversation');
const EVENTS = require('../events');

const handleJoinLevelRoom = async (io, socket, data) => {
    try {
        const { level } = data;
        
        if (!level || !['L1', 'L2', 'L3', 'M1', 'M2'].includes(level)) {
            socket.emit(EVENTS.APP_ERROR, { message: 'Invalid level' });
            return;
        }
        
        // Leave previous level room
        if (socket.currentLevel) {
            socket.leave(`level:${socket.currentLevel}`);
        }
        
        // Join new level room
        socket.join(`level:${level}`);
        socket.currentLevel = level;
        
        // Get or create level chat conversation
        const conversation = await Conversation.getOrCreateLevelChat(level);
        
        socket.emit('level_room_joined', {
            level,
            conversationId: conversation.id
        });
        
        console.log(`User ${socket.user.email} joined level ${level} room`);
        
    } catch (error) {
        console.error('Join level room error:', error);
        socket.emit(EVENTS.APP_ERROR, { message: 'Failed to join level room' });
    }
};

const handleJoinConversation = async (io, socket, data) => {
    try {
        const conversationId = parseInt(data?.conversationId, 10);
        if (Number.isNaN(conversationId)) {
            socket.emit(EVENTS.APP_ERROR, { message: 'Invalid conversation ID' });
            return;
        }
        
        let participants = await Conversation.getParticipants(conversationId);
        let isParticipant = participants.some(p => p.id === socket.userId);
        
        if (!isParticipant) {
            const role = socket.user?.role_global;
            const canJoin = await Conversation.canJoinCommunityConversation(
                socket.userId,
                conversationId,
                role
            );
            if (!canJoin) {
                socket.emit(EVENTS.APP_ERROR, { message: 'Not a participant' });
                return;
            }
            await Conversation.addParticipant(conversationId, socket.userId, 'MEMBER');
            participants = await Conversation.getParticipants(conversationId);
            isParticipant = participants.some(p => p.id === socket.userId);
            if (!isParticipant) {
                socket.emit(EVENTS.APP_ERROR, { message: 'Not a participant' });
                return;
            }
        }
        
        socket.join(`conversation:${conversationId}`);
        
        console.log(`User ${socket.user.email} joined conversation ${conversationId}`);
        
    } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit(EVENTS.APP_ERROR, { message: 'Failed to join conversation' });
    }
};

const handleLeaveConversation = async (io, socket, data) => {
    try {
        const conversationId = parseInt(data?.conversationId, 10);
        if (Number.isNaN(conversationId)) return;
        
        socket.leave(`conversation:${conversationId}`);
        
        console.log(`User ${socket.user.email} left conversation ${conversationId}`);
        
    } catch (error) {
        console.error('Leave conversation error:', error);
    }
};

module.exports = {
    handleJoinLevelRoom,
    handleJoinConversation,
    handleLeaveConversation
};
