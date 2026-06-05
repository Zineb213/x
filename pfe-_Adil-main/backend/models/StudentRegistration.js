const { query, transaction } = require('../config/database');
const User = require('./User');
const { generateMatricule } = require('../utils/matriculeGenerator');
const schoolLevelService = require('../services/schoolLevelService');
const { HTTP_STATUS, ROLES } = require('../config/constants');

class StudentRegistration {
    static async createRequest({ email, nom, prenom, niveau, password, school_code }) {
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedSchoolCode = typeof school_code === 'string' ? school_code.trim().toUpperCase() : '';
        const normalizedNiveau = typeof niveau === 'string' ? niveau.trim() : '';

        if (!normalizedSchoolCode) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Le code ecole est requis' };
        }

        const school = await schoolLevelService.resolveSchoolByCode(normalizedSchoolCode);

        if (!school.is_active) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Cette ecole est suspendue. Inscription indisponible.' };
        }

        const school_id = school.id;
        const finalNiveau = await schoolLevelService.ensureLevelAllowedForSchool({
            schoolId: school_id,
            niveau: normalizedNiveau
        });

        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            throw { status: HTTP_STATUS.CONFLICT, message: 'Un compte existe deja avec cet email' };
        }

        const pending = await query(
            `SELECT id FROM student_registration_requests
             WHERE email = $1 AND status = 'PENDING'`,
            [normalizedEmail]
        );

        if (pending.rows.length > 0) {
            throw {
                status: HTTP_STATUS.CONFLICT,
                message: 'Une demande d inscription est deja en attente pour cet email'
            };
        }

        const passwordHash = await User.hashPassword(password);
        const result = await query(
            `INSERT INTO student_registration_requests (
                email, nom, prenom, niveau, password_hash, status, school_id
            )
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
             RETURNING id, email, nom, prenom, niveau, status, requested_at, school_id`,
            [normalizedEmail, nom.trim(), prenom.trim(), finalNiveau, passwordHash, school_id]
        );

        return result.rows[0];
    }

    static async getAll(status = null, schoolId = null) {
        const params = [];
        const whereParts = [];

        if (status) {
            params.push(status);
            whereParts.push(`r.status = $${params.length}`);
        }

        if (schoolId) {
            params.push(schoolId);
            whereParts.push(`r.school_id = $${params.length}`);
        }

        const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

        const result = await query(
            `SELECT r.id, r.email, r.nom, r.prenom, r.niveau, r.status,
                    r.requested_at, r.reviewed_at, r.review_comment, r.school_id,
                    reviewer.nom as reviewer_nom, reviewer.prenom as reviewer_prenom
             FROM student_registration_requests r
             LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
             ${where}
             ORDER BY r.requested_at DESC`,
            params
        );

        return result.rows;
    }

    static async approve(requestId, adminId, schoolId = null, niveauOverride = null) {
        return transaction(async (client) => {
            const requestResult = await client.query(
                `SELECT * FROM student_registration_requests
                 WHERE id = $1
                 FOR UPDATE`,
                [requestId]
            );

            if (requestResult.rows.length === 0) {
                throw { status: HTTP_STATUS.NOT_FOUND, message: 'Demande introuvable' };
            }

            const request = requestResult.rows[0];
            if (request.status !== 'PENDING') {
                throw { status: HTTP_STATUS.CONFLICT, message: 'Cette demande est deja traitee' };
            }

            if (schoolId && request.school_id !== schoolId) {
                throw { status: HTTP_STATUS.FORBIDDEN, message: 'Cannot approve registration from another school' };
            }

            const finalNiveau = await schoolLevelService.ensureLevelAllowedForSchool({
                schoolId: request.school_id,
                niveau: niveauOverride || request.niveau
            });

            const existingUser = await client.query(
                `SELECT id FROM users WHERE email = $1`,
                [request.email]
            );
            if (existingUser.rows.length > 0) {
                await client.query(
                    `UPDATE student_registration_requests
                     SET status = 'REJECTED',
                         reviewed_by = $1,
                         reviewed_at = CURRENT_TIMESTAMP,
                         review_comment = 'Rejet auto: email deja utilise'
                     WHERE id = $2`,
                    [adminId, requestId]
                );
                throw {
                    status: HTTP_STATUS.CONFLICT,
                    message: 'Email deja utilise. Demande rejetee automatiquement.'
                };
            }

            const matricule = await generateMatricule();
            const userResult = await client.query(
                `INSERT INTO users (
                    matricule, email, password_hash, nom, prenom, role_global, niveau, school_id
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, matricule, email, nom, prenom, role_global, niveau, school_id, is_active`,
                [
                    matricule,
                    request.email,
                    request.password_hash,
                    request.nom,
                    request.prenom,
                    ROLES.ETUDIANT,
                    finalNiveau,
                    request.school_id
                ]
            );

            await client.query(
                `UPDATE student_registration_requests
                 SET status = 'APPROVED',
                     reviewed_by = $1,
                     reviewed_at = CURRENT_TIMESTAMP,
                     approved_user_id = $2
                 WHERE id = $3`,
                [adminId, userResult.rows[0].id, requestId]
            );

            return userResult.rows[0];
        });
    }

    static async reject(requestId, adminId, reason = null) {
        const result = await query(
            `UPDATE student_registration_requests
             SET status = 'REJECTED',
                 reviewed_by = $1,
                 reviewed_at = CURRENT_TIMESTAMP,
                 review_comment = $2
             WHERE id = $3
               AND status = 'PENDING'
             RETURNING id, email, nom, prenom, niveau, status, reviewed_at, review_comment`,
            [adminId, reason ? reason.trim() : null, requestId]
        );

        if (result.rows.length === 0) {
            throw {
                status: HTTP_STATUS.NOT_FOUND,
                message: 'Demande introuvable ou deja traitee'
            };
        }

        return result.rows[0];
    }
}

module.exports = StudentRegistration;