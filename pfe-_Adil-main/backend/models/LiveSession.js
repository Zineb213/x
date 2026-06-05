// models/LiveSession.js
const { query } = require('../config/database');

class LiveSession {
    static async create({ formateurId, moduleId, title, description, meetingLink, scheduledAt }) {
        const result = await query(
            `INSERT INTO live_sessions (formateur_id, module_id, title, description, meeting_link, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [formateurId, moduleId || null, title, description || null, meetingLink, scheduledAt || null]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await query(`SELECT * FROM live_sessions WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    static async findByFormateur(formateurId) {
        const result = await query(
            `SELECT ls.*, m.code as module_code, m.nom as module_nom
             FROM live_sessions ls
             LEFT JOIN modules m ON ls.module_id = m.id
             WHERE ls.formateur_id = $1
             ORDER BY
               CASE ls.status
                 WHEN 'LIVE'      THEN 1
                 WHEN 'SCHEDULED' THEN 2
                 ELSE 3
               END,
               COALESCE(ls.scheduled_at, ls.created_at) DESC`,
            [formateurId]
        );
        return result.rows;
    }

    /**
     * Retourne les sessions LIVE ou SCHEDULED pour les formateurs
     * des modules auxquels l'étudiant est inscrit.
     */
    static async findActiveForStudent(studentId) {
        const result = await query(
            `SELECT
                ls.*,
                u.nom  AS formateur_nom,
                u.prenom AS formateur_prenom,
                m.code AS module_code,
                m.nom  AS module_nom
             FROM live_sessions ls
             JOIN users u ON ls.formateur_id = u.id
             LEFT JOIN modules m ON ls.module_id = m.id
             WHERE ls.status IN ('LIVE', 'SCHEDULED')
               AND ls.formateur_id IN (
                   SELECT DISTINCT fma.formateur_id
                   FROM formateur_module_assignment fma
                   JOIN etudiant_module_enrollment eme
                     ON fma.module_id = eme.module_id
                   WHERE eme.etudiant_id = $1
                     AND eme.status = 'ACTIVE'
               )
             ORDER BY
               CASE ls.status WHEN 'LIVE' THEN 1 ELSE 2 END,
               COALESCE(ls.scheduled_at, ls.created_at) ASC`,
            [studentId]
        );
        return result.rows;
    }

    static async updateStatus(id, formateurId, status) {
        const now = new Date();
        let extra = '';
        const params = [status, id, formateurId];
        if (status === 'LIVE') {
            extra = ', started_at = $4';
            params.push(now);
        } else if (status === 'ENDED') {
            extra = ', ended_at = $4';
            params.push(now);
        }
        const result = await query(
            `UPDATE live_sessions SET status = $1${extra}
             WHERE id = $2 AND formateur_id = $3
             RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    static async delete(id, formateurId) {
        await query(
            `DELETE FROM live_sessions WHERE id = $1 AND formateur_id = $2`,
            [id, formateurId]
        );
        return true;
    }
}

module.exports = LiveSession;
