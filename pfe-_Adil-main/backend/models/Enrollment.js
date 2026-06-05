// models/Enrollment.js
const { query } = require('../config/database');

class Enrollment {
    static async enroll(etudiantId, moduleId) {
        const result = await query(
            `INSERT INTO etudiant_module_enrollment (etudiant_id, module_id, status)
             VALUES ($1, $2, 'ACTIVE')
             ON CONFLICT (etudiant_id, module_id) DO UPDATE 
             SET status = 'ACTIVE', enrolled_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [etudiantId, moduleId]
        );
        return result.rows[0];
    }

    static async unenroll(etudiantId, moduleId) {
        const result = await query(
            `UPDATE etudiant_module_enrollment 
             SET status = 'DROPPED' 
             WHERE etudiant_id = $1 AND module_id = $2
             RETURNING *`,
            [etudiantId, moduleId]
        );
        return result.rows[0];
    }

    static async findByEtudiant(etudiantId) {
        const result = await query(
            `SELECT m.*, e.enrolled_at, e.status
             FROM etudiant_module_enrollment e
             JOIN modules m ON e.module_id = m.id
             WHERE e.etudiant_id = $1 AND e.status = 'ACTIVE'`,
            [etudiantId]
        );
        return result.rows;
    }

    static async findByModule(moduleId) {
        const result = await query(
            `SELECT u.id, u.matricule, u.nom, u.prenom, u.email, e.enrolled_at
             FROM etudiant_module_enrollment e
             JOIN users u ON e.etudiant_id = u.id
             WHERE e.module_id = $1 AND e.status = 'ACTIVE'`,
            [moduleId]
        );
        return result.rows;
    }

    static async isEnrolled(etudiantId, moduleId) {
        const result = await query(
            `SELECT id FROM etudiant_module_enrollment 
             WHERE etudiant_id = $1 AND module_id = $2 AND status = 'ACTIVE'`,
            [etudiantId, moduleId]
        );
        return result.rows.length > 0;
    }

    static async getAllEnrollments() {
        const result = await query(`
            SELECT 
                e.id as enrollment_id,
                e.etudiant_id as student_id,
                u.school_id as student_school_id,
                u.email as student_email,
                u.nom as student_nom,
                u.prenom as student_prenom,
                u.niveau as student_niveau,
                m.id as module_id,
                m.school_id as module_school_id,
                m.code as module_code,
                m.nom as module_nom,
                m.niveau as module_niveau,
                e.enrolled_at,
                e.status
            FROM etudiant_module_enrollment e
            JOIN users u ON e.etudiant_id = u.id
            JOIN modules m ON e.module_id = m.id
            ORDER BY e.enrolled_at DESC
        `);
        return result.rows;
    }
}

module.exports = Enrollment;