// controllers/resourceController.js
const resourceService = require('../services/resourceService');
const path = require('path');
const { HTTP_STATUS } = require('../config/constants');

const getResources = async (req, res, next) => {
    try {
        const { moduleId } = req.query;
        const resources = await resourceService.getResourcesByUser(req.user, moduleId);
        res.status(HTTP_STATUS.OK).json({ success: true, data: resources });
    } catch (error) {
        next(error);
    }
};

const downloadResource = async (req, res, next) => {
    try {
        const { id } = req.params;
        const resource = await resourceService.downloadResource(id, req.user);
        
        const filePath = path.resolve(resource.file_path);
        res.download(filePath, resource.file_name);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getResources,
    downloadResource
};
