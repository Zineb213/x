// routes/resourceRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const {
    getResources,
    downloadResource
} = require('../controllers/resourceController');

const router = express.Router();

router.use(authenticate);

router.get('/', getResources);
router.get('/:id/download', downloadResource);

module.exports = router;
