// models/Assignment.js
const { query } = require('../config/database');

class Assignment {
    static async assign(formateurId, moduleId, assignedBy, assignmentType = 'SIMPLE', componentScope = null) {
        // Validation: PRINCIPAL ne doit pas avoir de componentScope
        if (assignmentType === 'PRINCIPAL' && componentScope !== null) {
            throw new Error('PRINCIPAL assignment cannot have component scope');
        }
        // Validation: SIMPLE doit avoir componentScope
        if (assignmentType === 'SIMPLE' && (!componentScope || componentScope.length === 0)) {
            throw new Error('SIMPLE assignment requires component scope');
        }

        const result = await query(
            `INSERT INTO formateur_module_assignment (formateur_id, module_id, assigned_by, assignment_type, component_scope)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (formateur_id, module_id) DO UPDATE
             SET assigned_by = EXCLUDED.assigned_by,
                 assigned_at = CURRENT_TIMESTAMP,
                 assignment_type = EXCLUDED.assignment_type,
                 component_scope = EXCLUDED.component_scope
             RETURNING *`,
            [formateurId, moduleId, assignedBy, assignmentType, componentScope]
        );
        return result.rows[0];
    }

    static async findByFormateur(formateurId) {
        const result = await query(
            `SELECT m.*, fma.assigned_at, fma.assignment_type, fma.component_scope FROM formateur_module_assignment fma
             JOIN modules m ON fma.module_id = m.id
             WHERE fma.formateur_id = $1`,
            [formateurId]
        );
        return result.rows;
    }

    static async findByModule(moduleId) {
        const result = await query(
            `SELECT u.id, u.matricule, u.nom, u.prenom, u.email, fma.assigned_at, fma.assignment_type, fma.component_scope
             FROM formateur_module_assignment fma
             JOIN users u ON fma.formateur_id = u.id
             WHERE fma.module_id = $1`,
            [moduleId]
        );
        return result.rows;
    }

    static async removeAssignment(formateurId, moduleId) {
        await query(
            `DELETE FROM formateur_module_assignment WHERE formateur_id = $1 AND module_id = $2`,
            [formateurId, moduleId]
        );
        return true;
    }

    static async isFormateurAssigned(formateurId, moduleId) {
        const result = await query(
            `SELECT id FROM formateur_module_assignment WHERE formateur_id = $1 AND module_id = $2`,
            [formateurId, moduleId]
        );
        return result.rows.length > 0;
    }

    static async getAssignment(formateurId, moduleId) {
        const result = await query(
            `SELECT * FROM formateur_module_assignment
             WHERE formateur_id = $1 AND module_id = $2
             LIMIT 1`,
            [formateurId, moduleId]
        );
        return result.rows[0] || null;
    }

    static async canManageCategory(formateurId, moduleId, category) {
        const assignment = await this.getAssignment(formateurId, moduleId);
        if (!assignment) return false;
        if (assignment.assignment_type === 'PRINCIPAL') return true;
        const scope = Array.isArray(assignment.component_scope) ? assignment.component_scope : [];
        return scope.includes(category);
    }

    static async getPrimaryByModule(moduleId) {
        const result = await query(
            `SELECT fma.*, u.role_global, u.nom, u.prenom
             FROM formateur_module_assignment fma
             JOIN users u ON u.id = fma.formateur_id
             WHERE fma.module_id = $1 AND fma.assignment_type = 'PRINCIPAL'
             LIMIT 1`,
            [moduleId]
        );
        return result.rows[0] || null;
    }

    static async isPrimaryFormateur(formateurId, moduleId) {
        const result = await query(
            `SELECT id FROM formateur_module_assignment
             WHERE formateur_id = $1 AND module_id = $2 AND assignment_type = 'PRINCIPAL'`,
            [formateurId, moduleId]
        );
        return result.rows.length > 0;
    }
}

module.exports = Assignment;
