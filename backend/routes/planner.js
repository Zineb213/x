const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getWeeklyPlanner, saveWeeklyPlanner } = require('../controllers/plannerController');

const router = express.Router();

router.get('/', authMiddleware, getWeeklyPlanner);
router.put('/', authMiddleware, saveWeeklyPlanner);

module.exports = router;
