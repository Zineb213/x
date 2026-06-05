const express = require('express');
const { getAllResources, getResourceById, createResource, updateResource, deleteResource } = require('../controllers/resourceController');
const { authMiddleware, moderatorMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Routes publiques
router.get('/', getAllResources);
router.get('/:id', getResourceById);

// Routes protégées (admin/modérateur)
router.post('/', authMiddleware, moderatorMiddleware, createResource);
router.put('/:id', authMiddleware, moderatorMiddleware, updateResource);
router.delete('/:id', authMiddleware, moderatorMiddleware, deleteResource);

module.exports = router;
