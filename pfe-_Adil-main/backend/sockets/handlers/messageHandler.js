// sockets/handlers/messageHandler.js
const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const EVENTS = require('../events');

const handleSendMessage = async (io, socket, data) => {
    try {
        const { conversationId: rawCid, content, replyToId } = data;
        const conversationId = parseInt(rawCid, 10);

        if (!rawCid || Number.isNaN(conversationId) || !content || !String(content).trim()) {
            socket.emit(EVENTS.APP_ERROR, { message: 'Conversation ID and content are required' });
            return;
        }

        const isParticipant = await Conversation.isParticipant(conversationId, socket.userId);
        if (!isParticipant) {
            socket.emit(EVENTS.APP_ERROR, { message: 'Not a participant' });
            return;
        }
        
        await Message.create({
            conversation_id: conversationId,
            user_id: socket.userId,
            content: String(content).trim(),
            reply_to_message_id: replyToId
        });
        
        const recent = await Message.getConversationMessages(conversationId, 1, 0);
        const fullMessage = recent[recent.length - 1];
        if (!fullMessage) {
            socket.emit(EVENTS.APP_ERROR, { message: 'Message not found after send' });
            return;
        }

        io.to(`conversation:${conversationId}`).emit(EVENTS.NEW_MESSAGE, fullMessage);
        
    } catch (error) {
        console.error('Send message error:', error);
        socket.emit(EVENTS.APP_ERROR, { message: 'Failed to send message' });
    }
};

const handleMarkRead = async (io, socket, data) => {
    try {
        const conversationId = parseInt(data?.conversationId, 10);
        if (Number.isNaN(conversationId)) return;

        const isParticipant = await Conversation.isParticipant(conversationId, socket.userId);
        if (!isParticipant) return;
        
        await Conversation.updateLastRead(conversationId, socket.userId);
        
        socket.to(`conversation:${conversationId}`).emit(EVENTS.MESSAGE_READ, {
            conversationId,
            userId: socket.userId,
            readAt: new Date()
        });
        
    } catch (error) {
        console.error('Mark read error:', error);
    }
};

const handleTypingStart = async (io, socket, data) => {
    try {
        const conversationId = parseInt(data?.conversationId, 10);
        if (Number.isNaN(conversationId)) return;

        const isParticipant = await Conversation.isParticipant(conversationId, socket.userId);
        if (!isParticipant) return;
        
        socket.to(`conversation:${conversationId}`).emit(EVENTS.USER_TYPING, {
            conversationId,
            userId: socket.userId,
            nom: socket.user.nom,
            prenom: socket.user.prenom
        });
        
    } catch (error) {
        console.error('Typing start error:', error);
    }
};

const handleTypingEnd = async (io, socket, data) => {
    try {
        const conversationId = parseInt(data?.conversationId, 10);
        if (Number.isNaN(conversationId)) return;

        const isParticipant = await Conversation.isParticipant(conversationId, socket.userId);
        if (!isParticipant) return;
        
        socket.to(`conversation:${conversationId}`).emit(EVENTS.USER_TYPING, {
            conversationId,
            userId: socket.userId,
            typing: false
        });
        
    } catch (error) {
        console.error('Typing end error:', error);
    }
};

module.exports = {
    handleSendMessage,
    handleMarkRead,
    handleTypingStart,
    handleTypingEnd
};
