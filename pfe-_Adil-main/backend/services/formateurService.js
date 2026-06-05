// services/formateurService.js
const { query } = require('../config/database');
const Assignment = require('../models/Assignment');
const Resource = require('../models/Resource');
const { HTTP_STATUS } = require('../config/constants');

class FormateurService {
    async getMyModules(formateurId) {
        const modules = await Assignment.findByFormateur(formateurId);
        return modules;
    }

    async getModuleStats(formateurId, moduleId) {
        // Get module details
        const module = await query(`SELECT * FROM modules WHERE id = $1`, [moduleId]);
        
        // Get resources count
        const resources = await query(`SELECT COUNT(*) FROM ressource_pedagogique WHERE module_id = $1`, [moduleId]);
        
        // Get students count
        const students = await query(`
            SELECT COUNT(DISTINCT e.etudiant_id) 
            FROM etudiant_module_enrollment e
            WHERE e.module_id = $1 AND e.status = 'ACTIVE'
        `, [moduleId]);
        
        // Get total downloads
        const downloads = await query(`
            SELECT SUM(download_count) 
            FROM ressource_pedagogique 
            WHERE module_id = $1
        `, [moduleId]);
        
        return {
            module: module.rows[0],
            resourcesCount: parseInt(resources.rows[0].count),
            studentsCount: parseInt(students.rows[0].count),
            totalDownloads: parseInt(downloads.rows[0].sum) || 0
        };
    }

    async getMyStudents(formateurId) {
        // Get all modules assigned to this formateur
        const modules = await Assignment.findByFormateur(formateurId);
        const moduleIds = modules.map(m => m.id);
        
        if (moduleIds.length === 0) return [];
        
        const placeholders = moduleIds.map((_, i) => `$${i + 1}`).join(',');
        const result = await query(`
            SELECT DISTINCT 
                u.id, u.matricule, u.email, u.nom, u.prenom, u.niveau,
                COUNT(DISTINCT e.module_id) as enrolled_modules,
                COUNT(DISTINCT sp.resource_id) as completed_resources
            FROM etudiant_module_enrollment e
            JOIN users u ON e.etudiant_id = u.id
            LEFT JOIN student_progress sp ON u.id = sp.student_id AND sp.status = 'COMPLETED'
            WHERE e.module_id IN (${placeholders})
            AND e.status = 'ACTIVE'
            GROUP BY u.id
            ORDER BY u.nom, u.prenom
        `, moduleIds);
        
        return result.rows;
    }

    async getDashboardStats(formateurId) {
        const modules = await Assignment.findByFormateur(formateurId);
        const moduleIds = modules.map(m => m.id);
        
        if (moduleIds.length === 0) {
            return { totalModules: 0, totalResources: 0, totalStudents: 0, totalDownloads: 0 };
        }
        
        const placeholders = moduleIds.map((_, i) => `$${i + 1}`).join(',');
        
        // Total resources
        const resources = await query(`
            SELECT COUNT(*) FROM ressource_pedagogique 
            WHERE module_id IN (${placeholders})
        `, moduleIds);
        
        // Total students
        const students = await query(`
            SELECT COUNT(DISTINCT etudiant_id) 
            FROM etudiant_module_enrollment 
            WHERE module_id IN (${placeholders}) AND status = 'ACTIVE'
        `, moduleIds);
        
        // Total downloads
        const downloads = await query(`
            SELECT SUM(download_count) 
            FROM ressource_pedagogique 
            WHERE module_id IN (${placeholders})
        `, moduleIds);
        
        // Recent activity (last 7 days)
        const recent = await query(`
            SELECT r.*, m.nom as module_nom, u.nom as student_nom, u.prenom as student_prenom
            FROM ressource_pedagogique r
            JOIN modules m ON r.module_id = m.id
            LEFT JOIN users u ON r.uploaded_by = u.id
            WHERE r.module_id IN (${placeholders})
            ORDER BY r.created_at DESC
            LIMIT 10
        `, moduleIds);
        
        return {
            totalModules: modules.length,
            totalResources: parseInt(resources.rows[0].count) || 0,
            totalStudents: parseInt(students.rows[0].count) || 0,
            totalDownloads: parseInt(downloads.rows[0].sum) || 0,
            recentResources: recent.rows
        };
    }
}

module.exports = new FormateurService();
