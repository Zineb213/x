// controllers/chatController.js
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { HTTP_STATUS } = require('../config/constants');

const createPrivateChat = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId || Number(userId) === Number(req.user.id)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Identifiant utilisateur invalide'
            });
        }
        
        const conversation = await Conversation.createPrivate(req.user.id, userId);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        next(error);
    }
};

const createGroupChat = async (req, res, next) => {
    try {
        const { groupName, participantIds } = req.body;
        
        const conversation = await Conversation.createGroup(groupName, req.user.id, participantIds);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        next(error);
    }
};

const getMyConversations = async (req, res, next) => {
    try {
        const conversations = await Conversation.getUserConversations(req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: conversations
        });
    } catch (error) {
        next(error);
    }
};

const getConversationMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const isParticipant = await Conversation.isParticipant(id, req.user.id);
        if (!isParticipant) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Accès refusé à cette conversation'
            });
        }
        
        const messages = await Message.getConversationMessages(id, limit, offset);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

const getConversationParticipants = async (req, res, next) => {
    try {
        const { id } = req.params;

        const isParticipant = await Conversation.isParticipant(id, req.user.id);
        if (!isParticipant) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Accès refusé à cette conversation'
            });
        }
        
        const participants = await Conversation.getParticipants(id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: participants
        });
    } catch (error) {
        next(error);
    }
};

const addParticipant = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const requesterRole = await Conversation.getParticipantRole(id, req.user.id);
        const isAdmin = req.user.role_global === 'ADMIN';
        if (!isAdmin && requesterRole !== 'OWNER') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Seul le propriétaire (ou admin) peut ajouter un participant'
            });
        }
        
        const participant = await Conversation.addParticipant(id, userId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: participant,
            message: 'Participant added successfully'
        });
    } catch (error) {
        next(error);
    }
};

const removeParticipant = async (req, res, next) => {
    try {
        const { id, userId } = req.params;

        const requesterRole = await Conversation.getParticipantRole(id, req.user.id);
        const isAdmin = req.user.role_global === 'ADMIN';
        if (!isAdmin && requesterRole !== 'OWNER' && Number(req.user.id) !== Number(userId)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Suppression non autorisée'
            });
        }
        
        await Conversation.removeParticipant(id, parseInt(userId));
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Participant removed successfully'
        });
    } catch (error) {
        next(error);
    }
};

const getLevelChat = async (req, res, next) => {
    try {
        const { level } = req.params;
        
        const conversation = await Conversation.getOrCreateLevelChat(level);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPrivateChat,
    createGroupChat,
    getMyConversations,
    getConversationMessages,
    getConversationParticipants,
    addParticipant,
    removeParticipant,
    getLevelChat
};
