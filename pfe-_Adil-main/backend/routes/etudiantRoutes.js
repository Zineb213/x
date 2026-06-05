// routes/etudiantRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const { requireEtudiant } = require('../middlewares/roleMiddleware');
const {
    getMyModules,
    getMyResources,
    downloadResource,
    updateProfile,
    selectNiveau,
    getModuleFormateur,
    getModuleFormateurs,
    getOrCreateChatWithFormateur,
    getMyBadges,
    getMyProgress,
    getRecentResources,
    completeResource,
    getEnrollmentOptions,
    getModuleFormateursWithGroups,
    getFormateurScheduleForModule,
    reserveGroupEnrollment,
    getMyGroupEnrollments,
    getAssistantStatus,
    askAssistant,
    getActiveLives
} = require('../controllers/etudiantController');

const router = express.Router();

// All student routes require authentication and ETUDIANT role
router.use(authenticate);
router.use(requireEtudiant);

// Module routes
router.get('/modules', getMyModules);
router.get('/enrollment/options', getEnrollmentOptions);
router.get('/enrollment/modules/:moduleId/formateurs', getModuleFormateursWithGroups);
router.get('/enrollment/formateurs/:formateurId/schedule', getFormateurScheduleForModule);
router.post('/enrollment/groups/:groupId/reserve', reserveGroupEnrollment);
router.get('/enrollment/my-groups', getMyGroupEnrollments);

// Resource routes
router.get('/resources', getMyResources);
router.get('/resources/recent', getRecentResources);
router.get('/resources/:id/download', downloadResource);
router.post('/resources/complete', completeResource);

// Progress & Badges
router.get('/progress', getMyProgress);
router.get('/badges', getMyBadges);

// Profile
router.put('/profile', updateProfile);
router.post('/select-niveau', selectNiveau);

// Chat with formateur
router.get('/modules/:moduleId/formateur', getModuleFormateur);
router.get('/modules/:moduleId/formateurs', getModuleFormateurs);
router.post('/chat/formateur', getOrCreateChatWithFormateur);
router.get('/assistant/status', getAssistantStatus);
router.post('/assistant/ask', askAssistant);

// Live sessions
router.get('/lives', getActiveLives);

module.exports = router;
