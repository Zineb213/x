// services/resourceService.js
const Resource = require('../models/Resource');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const { HTTP_STATUS, ROLES } = require('../config/constants');

class ResourceService {
    async getResourcesByUser(user, moduleId = null) {
        let resources = [];
        
        if (user.role_global === ROLES.ADMIN) {
            // Admin sees all resources
            if (moduleId) {
                resources = await Resource.findByModule(moduleId);
            } else {
                // Get all resources by niveau or all
                const { rows } = await require('../config/database').query(
                    `SELECT r.*, m.niveau as module_niveau FROM ressource_pedagogique r
                     JOIN modules m ON r.module_id = m.id
                     ORDER BY r.created_at DESC`
                );
                resources = rows;
            }
        } 
        else if ([ROLES.FORMATEUR, ROLES.FORMATEUR_SIMPLE].includes(user.role_global)) {
            // Formateurs see resources from their assigned modules.
            // Formateur simple sees approved resources + own pending resources.
            const assignedModules = await Assignment.findByFormateur(user.id);
            const moduleIds = assignedModules.map(m => m.id);
            
            if (moduleIds.length > 0) {
                const placeholders = moduleIds.map((_, i) => `$${i + 1}`).join(',');
                const approvalCondition = user.role_global === ROLES.FORMATEUR_SIMPLE
                    ? `AND (r.approval_status = 'APPROVED' OR r.uploaded_by = $${moduleIds.length + 1})`
                    : '';
                const params = user.role_global === ROLES.FORMATEUR_SIMPLE
                    ? [...moduleIds, user.id]
                    : moduleIds;
                const { rows } = await require('../config/database').query(
                    `SELECT r.*, m.niveau as module_niveau FROM ressource_pedagogique r
                     JOIN modules m ON r.module_id = m.id
                     WHERE r.module_id IN (${placeholders})
                     ${approvalCondition}
                     ORDER BY r.created_at DESC`,
                    params
                );
                resources = rows;
            }
        } 
        else if (user.role_global === ROLES.ETUDIANT) {
            // Student sees only resources from modules where they are actively enrolled.
            const enrolledModules = await Enrollment.findByEtudiant(user.id);
            const enrolledModuleIds = enrolledModules.map((m) => m.id);

            if (enrolledModuleIds.length > 0) {
                resources = (await Promise.all(enrolledModuleIds.map((mid) => Resource.findByModule(mid))))
                    .flat()
                    .filter((r) => r.approval_status === 'APPROVED');
            }
        }
        
        return resources;
    }
    
    async downloadResource(resourceId, user) {
        const resource = await Resource.findById(resourceId);
        
        if (!resource) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Resource not found' };
        }
        
        // Check access
        let hasAccess = false;
        
        if (user.role_global === ROLES.ADMIN) {
            hasAccess = true;
        } 
        else if ([ROLES.FORMATEUR, ROLES.FORMATEUR_SIMPLE].includes(user.role_global)) {
            const isAssigned = await Assignment.isFormateurAssigned(user.id, resource.module_id);
            hasAccess = isAssigned;
        } 
        else if (user.role_global === ROLES.ETUDIANT) {
            hasAccess = await Enrollment.isEnrolled(user.id, resource.module_id);
        }
        
        if (!hasAccess) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Access denied' };
        }
        
        await Resource.incrementDownloadCount(resourceId);
        return resource;
    }
}

module.exports = new ResourceService();
