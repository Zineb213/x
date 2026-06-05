const express = require('express');
const {
    getMyChats, createGroupChat, getOrCreatePrivateChat,
    getChatMessages, sendMessage, deleteMessage, addMemberToGroup
} = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getMyChats);
router.post('/groupe', authMiddleware, createGroupChat);
router.post('/prive', authMiddleware, getOrCreatePrivateChat);
router.get('/:id/messages', authMiddleware, getChatMessages);
router.post('/:id/messages', authMiddleware, sendMessage);
router.delete('/:id/messages/:msgId', authMiddleware, deleteMessage);
router.post('/:id/membres', authMiddleware, addMemberToGroup);

module.exports = router;
