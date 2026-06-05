const express = require('express');
const {
    getAllPublications, createPublication, deletePublication,
    votePublication, addComment, getComments, sharePublication
} = require('../controllers/publicationController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getAllPublications);
router.post('/', authMiddleware, createPublication);
router.delete('/:id', authMiddleware, deletePublication);
router.post('/:id/vote', authMiddleware, votePublication);
router.get('/:id/comments', authMiddleware, getComments);
router.post('/:id/comments', authMiddleware, addComment);
router.post('/:id/share', authMiddleware, sharePublication);

module.exports = router;
