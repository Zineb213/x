// routes/chatRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const {
    createPrivateChat,
    createGroupChat,
    getMyConversations,
    getConversationMessages,
    getConversationParticipants,
    addParticipant,
    removeParticipant,
    getLevelChat
} = require('../controllers/chatController');

const router = express.Router();

router.use(authenticate);

// Conversations
router.post('/private', createPrivateChat);
router.post('/group', createGroupChat);
router.get('/conversations', getMyConversations);
router.get('/conversations/:id/messages', getConversationMessages);
router.get('/conversations/:id/participants', getConversationParticipants);
router.post('/conversations/:id/participants', addParticipant);
router.delete('/conversations/:id/participants/:userId', removeParticipant);

// Level chat
router.get('/level/:level', getLevelChat);

module.exports = router;
