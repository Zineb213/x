const express = require('express');
const { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getMyNotifications);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.put('/:id/read', authMiddleware, markAsRead);
router.put('/read-all', authMiddleware, markAllAsRead);

module.exports = router;
