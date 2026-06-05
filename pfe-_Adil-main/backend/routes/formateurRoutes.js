const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const { requireFormateur } = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
    getMyModules,
    getModuleStats,
    getDashboardStats,
    getMyStudents,
    uploadResource,
    getMyResources,
    deleteResource,
    updateResource,
    getPendingResources,
    reviewResource,
    createLive,
    getMyLives,
    startLive,
    endLive,
    deleteLive
} = require('../controllers/formateurController');

const router = express.Router();

router.use(authenticate);
router.use(requireFormateur);

// Dashboard
router.get('/stats', getDashboardStats);

// Modules
router.get('/modules', getMyModules);
router.get('/modules/:id/stats', getModuleStats);

// Students
router.get('/students', getMyStudents);

// Resources
router.post('/resources', upload.single('file'), uploadResource);
router.get('/resources', getMyResources);
router.get('/resources/pending', getPendingResources);
router.put('/resources/:id/review', reviewResource);
router.put('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);

// Live Sessions
router.post('/live', createLive);
router.get('/live', getMyLives);
router.patch('/live/:id/start', startLive);
router.patch('/live/:id/end', endLive);
router.delete('/live/:id', deleteLive);

module.exports = router;
