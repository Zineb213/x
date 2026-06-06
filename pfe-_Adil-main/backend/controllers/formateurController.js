// controllers/formateurController.js
const formateurService = require('../services/formateurService');
const Resource = require('../models/Resource');
const Assignment = require('../models/Assignment');
const LiveSession = require('../models/LiveSession');
const { HTTP_STATUS } = require('../config/constants');

const getMyModules = async (req, res, next) => {
    try {
        const modules = await formateurService.getMyModules(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: modules });
    } catch (error) {
        next(error);
    }
};

const getModuleStats = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stats = await formateurService.getModuleStats(req.user.id, id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

const getDashboardStats = async (req, res, next) => {
    try {
        const stats = await formateurService.getDashboardStats(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

const getMyStudents = async (req, res, next) => {
    try {
        const students = await formateurService.getMyStudents(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: students });
    } catch (error) {
        next(error);
    }
};

const uploadResource = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'File is required'
            });
        }
        
        const { module_id, titre, description, category } = req.body;
        
        if (!module_id || !titre || !category) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'module_id, titre, and category are required'
            });
        }
        
        // Verify formateur is assigned to this module and determine approval workflow by assignment type.
        const assignment = await Assignment.getAssignment(req.user.id, module_id);
        if (!assignment) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You are not assigned to this module'
            });
        }

        if (assignment.assignment_type === 'SIMPLE') {
            const canManage = await Assignment.canManageCategory(req.user.id, module_id, category);
            if (!canManage) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous ne pouvez publier que sur les composants qui vous sont assignés (Cours/TD/TP)'
                });
            }
        }
        
        const shouldRequireApproval = assignment.assignment_type === 'SIMPLE';

        const resource = await Resource.create({
            module_id,
            uploaded_by: req.user.id,
            titre,
            description,
            category,
            file_path: req.file.path,
            file_name: req.file.filename,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            approval_status: shouldRequireApproval ? 'PENDING' : 'APPROVED',
            approved_by: shouldRequireApproval ? null : req.user.id,
            approved_at: shouldRequireApproval ? null : new Date().toISOString()
        });
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: resource,
            message: shouldRequireApproval
                ? 'Ressource envoyée en attente de validation par le formateur principal'
                : 'Resource uploaded successfully'
        });
    } catch (error) {
        next(error);
    }
};

const getMyResources = async (req, res, next) => {
    try {
        const resources = await Resource.findByFormateur(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: resources });
    } catch (error) {
        next(error);
    }
};

const deleteResource = async (req, res, next) => {
    try {
        const { id } = req.params;
        const resource = await Resource.findById(id);
        
        if (!resource) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Resource not found'
            });
        }
        
        if (resource.uploaded_by !== req.user.id) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You can only delete your own resources'
            });
        }

        if (req.user.role_global === 'FORMATEUR_SIMPLE') {
            const canManage = await Assignment.canManageCategory(req.user.id, resource.module_id, resource.category);
            if (!canManage) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous ne pouvez supprimer que les ressources de votre composant assigné'
                });
            }
        }
        
        await Resource.delete(id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Resource deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

const updateResource = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { titre, description, category } = req.body;
        
        const resource = await Resource.findById(id);
        if (!resource) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Resource not found'
            });
        }
        
        if (resource.uploaded_by !== req.user.id) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You can only edit your own resources'
            });
        }

        const assignment = await Assignment.getAssignment(req.user.id, resource.module_id);
        if (assignment && assignment.assignment_type === 'SIMPLE') {
            const targetCategory = category || resource.category;
            const canManage = await Assignment.canManageCategory(req.user.id, resource.module_id, targetCategory);
            if (!canManage) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous ne pouvez modifier que les ressources de votre composant assigné'
                });
            }
        }
        
        const updated = await Resource.update(id, { titre, description, category });

        if (assignment && assignment.assignment_type === 'SIMPLE') {
            await Resource.setApproval(id, 'PENDING', null);
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: updated,
            message: assignment && assignment.assignment_type === 'SIMPLE'
                ? 'Ressource modifiée et remise en attente de validation'
                : 'Resource updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

const getPendingResources = async (req, res, next) => {
    try {
        if (!['ADMIN', 'FORMATEUR'].includes(req.user.role_global)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Seul un admin ou un formateur principal peut valider des ressources'
            });
        }

        const pending = await Resource.findPendingForReviewer(req.user.id, req.user.role_global === 'ADMIN');
        res.status(HTTP_STATUS.OK).json({ success: true, data: pending });
    } catch (error) {
        next(error);
    }
};

const reviewResource = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Le statut doit être APPROVED ou REJECTED'
            });
        }

        if (!['ADMIN', 'FORMATEUR'].includes(req.user.role_global)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Seul un admin ou un formateur principal peut valider des ressources'
            });
        }

        const resource = await Resource.findById(id);
        if (!resource) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Resource not found'
            });
        }

        if (req.user.role_global === 'FORMATEUR') {
            const isPrimary = await Assignment.isPrimaryFormateur(req.user.id, resource.module_id);
            if (!isPrimary) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous devez être formateur principal du module pour valider'
                });
            }
        }

        const reviewed = await Resource.setApproval(id, status, req.user.id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: reviewed,
            message: status === 'APPROVED' ? 'Ressource approuvée' : 'Ressource rejetée'
        });
    } catch (error) {
        next(error);
    }
};

// ─── Live Sessions ───────────────────────────────────────────────────────────

const createLive = async (req, res, next) => {
    try {
        const { title, description, meetingLink, moduleId, scheduledAt } = req.body;
        if (!title || !meetingLink) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false, error: 'Le titre et le lien de réunion sont requis'
            });
        }
        const live = await LiveSession.create({
            formateurId: req.user.id,
            moduleId: moduleId || null,
            title,
            description,
            meetingLink,
            scheduledAt: scheduledAt || null
        });
        res.status(HTTP_STATUS.CREATED).json({ success: true, data: live });
    } catch (error) {
        next(error);
    }
};

const getMyLives = async (req, res, next) => {
    try {
        const lives = await LiveSession.findByFormateur(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: lives });
    } catch (error) {
        next(error);
    }
};

const startLive = async (req, res, next) => {
    try {
        const live = await LiveSession.updateStatus(req.params.id, req.user.id, 'LIVE');
        if (!live) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Session introuvable' });
        res.status(HTTP_STATUS.OK).json({ success: true, data: live });
    } catch (error) {
        next(error);
    }
};

const endLive = async (req, res, next) => {
    try {
        const live = await LiveSession.updateStatus(req.params.id, req.user.id, 'ENDED');
        if (!live) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Session introuvable' });
        res.status(HTTP_STATUS.OK).json({ success: true, data: live });
    } catch (error) {
        next(error);
    }
};

const deleteLive = async (req, res, next) => {
    try {
        await LiveSession.delete(req.params.id, req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, message: 'Session supprimée' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
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
};
