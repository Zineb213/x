// controllers/progressController.js
const progressService = require('../services/progressService');
const { HTTP_STATUS } = require('../config/constants');

const completeResource = async (req, res, next) => {
    try {
        const { resourceId, moduleId } = req.body;
        
        if (!resourceId || !moduleId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'resourceId and moduleId are required'
            });
        }
        
        const result = await progressService.completeResource(req.user.id, resourceId, moduleId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getMyProgress = async (req, res, next) => {
    try {
        const progress = await progressService.getStudentProgress(req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: progress
        });
    } catch (error) {
        next(error);
    }
};

const getMyBadges = async (req, res, next) => {
    try {
        const badges = await progressService.getStudentBadges(req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: badges
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    completeResource,
    getMyProgress,
    getMyBadges
};
