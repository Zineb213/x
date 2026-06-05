const express = require('express');
const {
    getDashboardStats, getAllUsers, updateUserRole,
    assignModuleToModerator, getModeratorModules, getModerationLog,
    getUpcoming, createUpcoming, search,
    getModulesCatalog, createModuleCatalog
} = require('../controllers/adminController');
const { authMiddleware, adminMiddleware, moderatorMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Recherche (tous les utilisateurs connectés)
router.get('/search', authMiddleware, search);

// Statistiques (admin/modérateur)
router.get('/stats', authMiddleware, moderatorMiddleware, getDashboardStats);
router.get('/moderation-log', authMiddleware, moderatorMiddleware, getModerationLog);
router.get('/upcoming', authMiddleware, getUpcoming);
router.post('/upcoming', authMiddleware, moderatorMiddleware, createUpcoming);
router.get('/modules', authMiddleware, getModulesCatalog);
router.post('/modules', authMiddleware, moderatorMiddleware, createModuleCatalog);

// Gestion utilisateurs (ADMIN_GLOBAL seulement)
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.put('/users/:id/role', authMiddleware, adminMiddleware, updateUserRole);

// Gestion modérateurs (ADMIN_GLOBAL seulement)
router.post('/moderateurs/assign', authMiddleware, adminMiddleware, assignModuleToModerator);
router.get('/moderateurs/:id/modules', authMiddleware, adminMiddleware, getModeratorModules);

module.exports = router;
