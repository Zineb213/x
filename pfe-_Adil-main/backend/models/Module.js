// models/Module.js
const { query } = require('../config/database');

class Module {
    static async create(moduleData) {
        const { code, nom, description, niveau, credits, coeff, created_by, components, school_id = null } = moduleData;
        const niveauDb = niveau || 'L1';
        const componentsDb = components || ['Cours', 'TD', 'TP'];
        const result = await query(
            `INSERT INTO modules (code, nom, description, niveau, credits, coeff, created_by, components, school_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [code, nom, description, niveauDb, credits || 0, coeff || 1.0, created_by, componentsDb, school_id]
        );
        return result.rows[0];
    }

    static async findAll(schoolId = null) {
        const result = schoolId
            ? await query(`SELECT * FROM modules WHERE school_id = $1 ORDER BY code`, [schoolId])
            : await query(`SELECT * FROM modules ORDER BY code`);
        return result.rows;
    }

    static async findByNiveau(niveau) {
        const result = await query(`SELECT * FROM modules WHERE niveau = $1 ORDER BY code`, [niveau]);
        return result.rows;
    }

    static async findById(id) {
        const result = await query(`SELECT * FROM modules WHERE id = $1`, [id]);
        return result.rows[0];
    }

    static async update(id, updates) {
        const { nom, description, credits, coeff, components } = updates;
        const result = await query(
            `UPDATE modules SET nom = $1, description = $2, credits = $3, coeff = $4, components = COALESCE($5, components), updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 RETURNING *`,
            [nom, description, credits, coeff, components, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        await query(`DELETE FROM modules WHERE id = $1`, [id]);
        return true;
    }

    static async getModulesByFormateur(formateurId) {
        const result = await query(
            `SELECT m.*, fma.assignment_type, fma.component_scope FROM modules m
             JOIN formateur_module_assignment fma ON m.id = fma.module_id
             WHERE fma.formateur_id = $1`,
            [formateurId]
        );
        return result.rows;
    }

    // Get formateur(s) assigned to a module (for student-formateur chat)
    static async getFormateursByModule(moduleId) {
        const result = await query(
            `SELECT u.id, u.matricule, u.email, u.nom, u.prenom, u.role_global
             FROM formateur_module_assignment fma
             JOIN users u ON fma.formateur_id = u.id
             WHERE fma.module_id = $1 AND u.is_active = true`,
            [moduleId]
        );
        return result.rows;
    }

    // Get components for a module
    static async getComponents(moduleId) {
        const result = await query(
            `SELECT components FROM modules WHERE id = $1`,
            [moduleId]
        );
        return result.rows[0]?.components || ['Cours', 'TD', 'TP'];
    }

    // Update components for a module
    static async updateComponents(moduleId, components) {
        if (!Array.isArray(components) || components.length === 0) {
            throw new Error('Components must be a non-empty array');
        }
        const result = await query(
            `UPDATE modules SET components = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING components`,
            [components, moduleId]
        );
        return result.rows[0]?.components;
    }
}

module.exports = Module;
