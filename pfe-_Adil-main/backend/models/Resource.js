// models/Resource.js
const { query } = require('../config/database');

class Resource {
    static async create(resourceData) {
        const {
            module_id,
            uploaded_by,
            titre,
            description,
            category,
            file_path,
            file_name,
            file_size,
            file_type,
            approval_status = 'APPROVED',
            approved_by = null,
            approved_at = null
        } = resourceData;
        const result = await query(
            `INSERT INTO ressource_pedagogique (
                module_id,
                uploaded_by,
                titre,
                description,
                category,
                file_path,
                file_name,
                file_size,
                file_type,
                approval_status,
                approved_by,
                approved_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                module_id,
                uploaded_by,
                titre,
                description,
                category,
                file_path,
                file_name,
                file_size,
                file_type,
                approval_status,
                approved_by,
                approved_at
            ]
        );
        return result.rows[0];
    }

    static async findByModule(moduleId) {
        const result = await query(
            `SELECT r.*, u.nom as uploader_nom, u.prenom as uploader_prenom
             FROM ressource_pedagogique r
             JOIN users u ON r.uploaded_by = u.id
             WHERE r.module_id = $1
             ORDER BY r.created_at DESC`,
            [moduleId]
        );
        return result.rows;
    }

    static async findByFormateur(formateurId) {
        const result = await query(
            `SELECT r.*, m.nom as module_nom, m.code as module_code
             FROM ressource_pedagogique r
             JOIN modules m ON r.module_id = m.id
             WHERE r.uploaded_by = $1
             ORDER BY r.created_at DESC`,
            [formateurId]
        );
        return result.rows;
    }

    static async update(id, updates) {
        const { titre, description, category } = updates;
        const result = await query(
            `UPDATE ressource_pedagogique
             SET titre = COALESCE($1, titre),
                 description = COALESCE($2, description),
                 category = COALESCE($3, category),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [titre, description, category, id]
        );
        return result.rows[0];
    }

    static async setApproval(id, status, approvedBy) {
        const result = await query(
            `UPDATE ressource_pedagogique
             SET approval_status = $1,
                 approved_by = $2,
                 approved_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, approvedBy, id]
        );
        return result.rows[0];
    }

    static async findPendingForReviewer(userId, isAdmin = false) {
        if (isAdmin) {
            const result = await query(
                `SELECT r.*, m.nom as module_nom, m.code as module_code,
                        u.nom as uploader_nom, u.prenom as uploader_prenom, u.role_global as uploader_role
                 FROM ressource_pedagogique r
                 JOIN modules m ON m.id = r.module_id
                 JOIN users u ON u.id = r.uploaded_by
                 WHERE r.approval_status = 'PENDING'
                 ORDER BY r.created_at ASC`
            );
            return result.rows;
        }

        const result = await query(
            `SELECT r.*, m.nom as module_nom, m.code as module_code,
                    u.nom as uploader_nom, u.prenom as uploader_prenom, u.role_global as uploader_role
             FROM ressource_pedagogique r
             JOIN modules m ON m.id = r.module_id
             JOIN users u ON u.id = r.uploaded_by
             JOIN formateur_module_assignment fma ON fma.module_id = r.module_id
             WHERE r.approval_status = 'PENDING'
               AND fma.formateur_id = $1
                             AND fma.assignment_type = 'PRINCIPAL'
             ORDER BY r.created_at ASC`,
            [userId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await query(
            `SELECT r.*, m.niveau as module_niveau, m.nom as module_nom
             FROM ressource_pedagogique r
             JOIN modules m ON r.module_id = m.id
             WHERE r.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async incrementDownloadCount(id) {
        await query(
            `UPDATE ressource_pedagogique SET download_count = download_count + 1 WHERE id = $1`,
            [id]
        );
    }

    static async delete(id) {
        await query(`DELETE FROM ressource_pedagogique WHERE id = $1`, [id]);
        return true;
    }

    static async getResourcesByNiveau(niveau) {
        const result = await query(
            `SELECT r.*, m.nom as module_nom, m.code as module_code
             FROM ressource_pedagogique r
             JOIN modules m ON r.module_id = m.id
             WHERE m.niveau = $1
               AND r.approval_status = 'APPROVED'
             ORDER BY r.created_at DESC`,
            [niveau]
        );
        return result.rows;
    }
}

module.exports = Resource;
