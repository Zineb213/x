// services/progressService.js
const { query } = require('../config/database');
const Enrollment = require('../models/Enrollment');

class ProgressService {
    // Complete a resource and award XP
    async completeResource(studentId, resourceId, moduleId) {
        const isEnrolled = await Enrollment.isEnrolled(studentId, moduleId);
        if (!isEnrolled) {
            throw { status: 403, message: 'Access denied. Student is not enrolled in this module.' };
        }

        // Check if already completed
        const existing = await query(
            `SELECT id, status FROM student_progress 
             WHERE student_id = $1 AND resource_id = $2 AND module_id = $3`,
            [studentId, resourceId, moduleId]
        );
        
        if (existing.rows.length > 0 && existing.rows[0].status === 'COMPLETED') {
            return { alreadyCompleted: true };
        }
        
        // Mark as completed
        const now = new Date();
        const result = await query(
            `INSERT INTO student_progress (student_id, resource_id, module_id, status, completed_at, last_accessed)
             VALUES ($1, $2, $3, 'COMPLETED', $4, $4)
             ON CONFLICT (student_id, resource_id, module_id) 
             DO UPDATE SET status = 'COMPLETED', completed_at = $4, last_accessed = $4
             RETURNING *`,
            [studentId, resourceId, moduleId, now]
        );
        
        // Award XP
        const xpEarned = await this.awardXP(studentId, 'COMPLETE_RESOURCE');
        
        // Check module completion
        await this.checkModuleCompletion(studentId, moduleId);
        
        return {
            success: true,
            xpEarned,
            progress: result.rows[0]
        };
    }
    
    // Award XP to student
    async awardXP(studentId, actionType) {
        // Get XP value for action
        const xpRule = await query(
            `SELECT xp_points FROM xp_rules WHERE action_type = $1`,
            [actionType]
        );
        
        if (xpRule.rows.length === 0) return 0;
        
        const xpPoints = xpRule.rows[0].xp_points;
        
        // Update student's total XP
        const result = await query(
            `UPDATE users 
             SET total_xp = total_xp + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 
             RETURNING total_xp, current_level`,
            [xpPoints, studentId]
        );
        
        // Update student_levels table
        await query(
            `INSERT INTO student_levels (student_id, total_xp, last_activity_date)
             VALUES ($1, $2, CURRENT_DATE)
             ON CONFLICT (student_id) 
             DO UPDATE SET total_xp = student_levels.total_xp + $2,
                           last_activity_date = CURRENT_DATE`,
            [studentId, xpPoints]
        );
        
        // Check for level up
        const newLevel = this.calculateLevel(result.rows[0].total_xp);
        const oldLevel = result.rows[0].current_level;
        
        if (newLevel > oldLevel) {
            await query(
                `UPDATE users SET current_level = $1 WHERE id = $2`,
                [newLevel, studentId]
            );
            
            await query(
                `UPDATE student_levels SET current_level = $1 WHERE student_id = $2`,
                [newLevel, studentId]
            );
            
            return { xpEarned: xpPoints, leveledUp: true, newLevel };
        }
        
        return { xpEarned: xpPoints, leveledUp: false };
    }
    
    /** Single learner track: 0 XP → 1000 XP Expert (UI only; independent of DB current_level). */
    getExpertTrackRank(totalXp) {
        const CAP = 1000;
        const xp = Math.max(0, Number(totalXp) || 0);
        const milestones = [
            { at: 0, label: 'Débutant', emoji: '🌟' },
            { at: 200, label: 'Apprenti', emoji: '📘' },
            { at: 400, label: 'Intermédiaire', emoji: '📗' },
            { at: 600, label: 'Avancé', emoji: '⚡' },
            { at: 800, label: 'Confirmé', emoji: '🎯' },
            { at: 1000, label: 'Expert', emoji: '🏆' }
        ];
        let idx = 0;
        for (let i = 0; i < milestones.length; i++) {
            if (xp >= milestones[i].at) idx = i;
        }
        const current = milestones[idx];
        const next = milestones[idx + 1];
        const nextMilestoneXp = next ? next.at : CAP;
        const capped = Math.min(xp, CAP);
        return {
            currentTitle: current.label,
            currentEmoji: current.emoji,
            nextTitle: next ? next.label : null,
            nextMilestoneXp,
            capXp: CAP,
            totalXp: xp,
            progressPercent: Math.min(100, (capped / CAP) * 100)
        };
    }

    // Calculate level based on XP
    calculateLevel(xp) {
        // Level thresholds: 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500
        if (xp >= 4500) return 10;
        if (xp >= 3600) return 9;
        if (xp >= 2800) return 8;
        if (xp >= 2100) return 7;
        if (xp >= 1500) return 6;
        if (xp >= 1000) return 5;
        if (xp >= 600) return 4;
        if (xp >= 300) return 3;
        if (xp >= 100) return 2;
        return 1;
    }
    
    // Check if all resources in a module are completed
    async checkModuleCompletion(studentId, moduleId) {
        // Get all resources in module
        const resources = await query(
            `SELECT id FROM ressource_pedagogique WHERE module_id = $1`,
            [moduleId]
        );
        
        const totalResources = resources.rows.length;
        if (totalResources === 0) return;
        
        // Get completed resources by student
        const completed = await query(
            `SELECT COUNT(*) as count FROM student_progress 
             WHERE student_id = $1 AND module_id = $2 AND status = 'COMPLETED'`,
            [studentId, moduleId]
        );
        
        const completedCount = parseInt(completed.rows[0].count);
        
        if (completedCount === totalResources && totalResources > 0) {
            // Module completed! Award bonus XP
            await this.awardXP(studentId, 'COMPLETE_MODULE');
        }
    }
    
    // Get student progress
    async getStudentProgress(studentId) {
        // Get overall stats
        const stats = await query(
            `SELECT 
                COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN resource_id END) as completed_resources,
                COUNT(DISTINCT resource_id) as total_resources,
                COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN module_id END) as completed_modules,
                COUNT(DISTINCT module_id) as total_modules
             FROM student_progress 
             WHERE student_id = $1`,
            [studentId]
        );
        
        // Get student level info
        const level = await query(
            `SELECT current_level, total_xp, resources_completed, modules_completed
             FROM student_levels 
             WHERE student_id = $1`,
            [studentId]
        );
        
        // Get recent activity
        const recent = await query(
            `SELECT sp.*, r.titre as resource_name, m.nom as module_name
             FROM student_progress sp
             JOIN ressource_pedagogique r ON sp.resource_id = r.id
             JOIN modules m ON sp.module_id = m.id
             WHERE sp.student_id = $1 AND sp.status = 'COMPLETED'
             ORDER BY sp.completed_at DESC
             LIMIT 10`,
            [studentId]
        );
        
        return {
            stats: stats.rows[0],
            level: level.rows[0] || { current_level: 1, total_xp: 0 },
            recent: recent.rows
        };
    }
    
    // Get available badges for student
    async getStudentBadges(studentId) {
        const badges = await query(
            `SELECT b.*, sb.earned_at 
             FROM badges b
             LEFT JOIN student_badges sb ON b.id = sb.badge_id AND sb.student_id = $1
             ORDER BY b.xp_required ASC`,
            [studentId]
        );
        
        return badges.rows;
    }
}

module.exports = new ProgressService();
