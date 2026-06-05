// routes/postRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const {
    createPost,
    getAllPosts,
    getPostById,
    updatePost,
    deletePost,
    addReaction,
    removeReaction,
    addComment,
    deleteComment,
    sharePost
} = require('../controllers/postController');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Post CRUD
router.post('/', createPost);
router.get('/', getAllPosts);
router.get('/:id', getPostById);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

// Reactions
router.post('/:id/reactions', addReaction);
router.delete('/:id/reactions', removeReaction);

// Comments
router.post('/:id/comments', addComment);
router.delete('/comments/:commentId', deleteComment);

// Shares
router.post('/:id/shares', sharePost);

module.exports = router;
