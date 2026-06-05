const { query, transaction } = require('../config/database');
const { HTTP_STATUS, ROLES } = require('../config/constants');
const { slugFromModuleCode } = require('../utils/moduleCommunitySlug');

class EnrollmentWorkflowService {
    async listModulesByNiveau({ schoolId, niveau, studentId }) {
        const result = await query(
            `SELECT m.id,
                    m.code,
                    m.nom,
                    m.niveau,
                    m.description,
                    COUNT(DISTINCT cg.id) AS groups_count,
                    COALESCE(
                        BOOL_OR(
                            sge.student_id = $3
                            AND sge.status = 'ACTIVE'
                        ),
                        false
                    ) AS already_enrolled
             FROM modules m
             LEFT JOIN course_groups cg
                    ON cg.module_id = m.id
                   AND cg.is_active = true
             LEFT JOIN student_group_enrollments sge
                    ON sge.module_id = m.id
                   AND sge.student_id = $3
             WHERE m.school_id = $1
               AND m.niveau = $2
             GROUP BY m.id
             ORDER BY m.code`,
            [schoolId, niveau, studentId]
        );

        return result.rows;
    }

    async listFormateursByModule({ schoolId, moduleId }) {
        const result = await query(
            `SELECT u.id,
                    u.nom,
                    u.prenom,
                    u.email,
                    COUNT(DISTINCT cg.id) FILTER (WHERE cg.is_active = true) AS total_groups,
                    COUNT(DISTINCT cg.id) FILTER (
                        WHERE cg.is_active = true
                          AND (
                            SELECT COUNT(*)
                            FROM student_group_enrollments sge
                            WHERE sge.group_id = cg.id
                              AND sge.status = 'ACTIVE'
                          ) < cg.capacity
                    ) AS available_groups
             FROM course_groups cg
             JOIN users u ON u.id = cg.formateur_id
             JOIN modules m ON m.id = cg.module_id
             WHERE cg.school_id = $1
               AND cg.module_id = $2
               AND cg.is_active = true
               AND m.school_id = $1
             GROUP BY u.id
             ORDER BY u.nom, u.prenom`,
            [schoolId, moduleId]
        );

        return result.rows;
    }

    async getFormateurSchedule({ schoolId, moduleId, formateurId }) {
        const result = await query(
            `SELECT cg.id AS group_id,
                    cg.group_name,
                    cg.capacity,
                    COALESCE(active_enrollments.count_active, 0) AS enrolled_count,
                    (cg.capacity - COALESCE(active_enrollments.count_active, 0)) AS remaining_seats,
                    slot.id AS slot_id,
                    slot.day_of_week,
                    slot.start_time,
                    slot.end_time
             FROM course_groups cg
             LEFT JOIN course_group_slots slot ON slot.group_id = cg.id
             LEFT JOIN (
                 SELECT sge.group_id, COUNT(*) AS count_active
                 FROM student_group_enrollments sge
                 WHERE sge.status = 'ACTIVE'
                 GROUP BY sge.group_id
             ) active_enrollments ON active_enrollments.group_id = cg.id
             WHERE cg.school_id = $1
               AND cg.module_id = $2
               AND cg.formateur_id = $3
               AND cg.is_active = true
             ORDER BY cg.group_name, slot.day_of_week, slot.start_time`,
            [schoolId, moduleId, formateurId]
        );

        const map = new Map();
        for (const row of result.rows) {
            if (!map.has(row.group_id)) {
                map.set(row.group_id, {
                    group_id: row.group_id,
                    group_name: row.group_name,
                    capacity: Number(row.capacity),
                    enrolled_count: Number(row.enrolled_count),
                    remaining_seats: Number(row.remaining_seats),
                    slots: []
                });
            }

            if (row.slot_id) {
                map.get(row.group_id).slots.push({
                    slot_id: row.slot_id,
                    day_of_week: row.day_of_week,
                    start_time: row.start_time,
                    end_time: row.end_time
                });
            }
        }

        return Array.from(map.values());
    }

    async createCourseGroup({ schoolId, moduleId, formateurId, groupName, capacity }) {
        const moduleCheck = await query(
            `SELECT id, school_id
             FROM modules
             WHERE id = $1`,
            [moduleId]
        );

        if (!moduleCheck.rows.length || moduleCheck.rows[0].school_id !== schoolId) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Module invalide pour cette ecole' };
        }

        const formateurCheck = await query(
            `SELECT id, school_id, role_global
             FROM users
             WHERE id = $1`,
            [formateurId]
        );

        if (!formateurCheck.rows.length) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Formateur introuvable' };
        }

        const formateur = formateurCheck.rows[0];
        if (formateur.school_id !== schoolId) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Ce formateur appartient a une autre ecole' };
        }

        if (![ROLES.FORMATEUR, ROLES.FORMATEUR_SIMPLE].includes(formateur.role_global)) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Utilisateur non formateur' };
        }

        const result = await query(
            `INSERT INTO course_groups (school_id, module_id, formateur_id, group_name, capacity)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, school_id, module_id, formateur_id, group_name, capacity, is_active, created_at`,
            [schoolId, moduleId, formateurId, groupName.trim(), capacity]
        );

        return result.rows[0];
    }

    async addGroupSlot({ schoolId, groupId, dayOfWeek, startTime, endTime }) {
        const groupCheck = await query(
            `SELECT id, school_id
             FROM course_groups
             WHERE id = $1`,
            [groupId]
        );

        if (!groupCheck.rows.length || groupCheck.rows[0].school_id !== schoolId) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Groupe invalide pour cette ecole' };
        }

        const overlap = await query(
            `SELECT id
             FROM course_group_slots
             WHERE group_id = $1
               AND day_of_week = $2
               AND start_time < $4
               AND $3 < end_time
             LIMIT 1`,
            [groupId, dayOfWeek, startTime, endTime]
        );

        if (overlap.rows.length > 0) {
            throw { status: HTTP_STATUS.CONFLICT, message: 'Chevauchement horaire detecte dans ce groupe' };
        }

        const result = await query(
            `INSERT INTO course_group_slots (group_id, day_of_week, start_time, end_time)
             VALUES ($1, $2, $3, $4)
             RETURNING id, group_id, day_of_week, start_time, end_time, created_at`,
            [groupId, dayOfWeek, startTime, endTime]
        );

        return result.rows[0];
    }

    async listCourseGroups({ schoolId, moduleId = null, formateurId = null }) {
        const params = [schoolId];
        let where = 'WHERE cg.school_id = $1';

        if (moduleId) {
            params.push(moduleId);
            where += ` AND cg.module_id = $${params.length}`;
        }

        if (formateurId) {
            params.push(formateurId);
            where += ` AND cg.formateur_id = $${params.length}`;
        }

        const result = await query(
            `SELECT cg.id,
                    cg.group_name,
                    cg.capacity,
                    cg.is_active,
                    cg.module_id,
                    m.code AS module_code,
                    m.nom AS module_nom,
                    m.niveau AS module_niveau,
                    cg.formateur_id,
                    u.nom AS formateur_nom,
                    u.prenom AS formateur_prenom,
                    COALESCE(active_enrollments.count_active, 0) AS enrolled_count,
                    (cg.capacity - COALESCE(active_enrollments.count_active, 0)) AS remaining_seats
             FROM course_groups cg
             JOIN modules m ON m.id = cg.module_id
             JOIN users u ON u.id = cg.formateur_id
             LEFT JOIN (
                SELECT group_id, COUNT(*) AS count_active
                FROM student_group_enrollments
                WHERE status = 'ACTIVE'
                GROUP BY group_id
             ) active_enrollments ON active_enrollments.group_id = cg.id
             ${where}
             ORDER BY m.code, cg.group_name`,
            params
        );

        return result.rows;
    }

    async reserveGroupForStudent({ schoolId, studentId, groupId }) {
        return transaction(async (client) => {
            const studentResult = await client.query(
                `SELECT id, school_id, niveau, role_global
                 FROM users
                 WHERE id = $1`,
                [studentId]
            );

            if (!studentResult.rows.length) {
                throw { status: HTTP_STATUS.NOT_FOUND, message: 'Etudiant introuvable' };
            }

            const student = studentResult.rows[0];
            if (student.school_id !== schoolId) {
                throw { status: HTTP_STATUS.FORBIDDEN, message: 'Acces interdit pour cette ecole' };
            }

            if (student.role_global !== ROLES.ETUDIANT) {
                throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Utilisateur non etudiant' };
            }

            if (!student.niveau) {
                throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Le niveau etudiant doit etre defini avant la reservation' };
            }

            const groupResult = await client.query(
                `SELECT cg.id,
                        cg.group_name,
                        cg.capacity,
                        cg.module_id,
                        cg.formateur_id,
                        m.code AS module_code,
                        m.nom AS module_nom,
                        m.niveau AS module_niveau,
                        m.school_id,
                        u.nom AS formateur_nom,
                        u.prenom AS formateur_prenom
                 FROM course_groups cg
                 JOIN modules m ON m.id = cg.module_id
                 JOIN users u ON u.id = cg.formateur_id
                 WHERE cg.id = $1
                   AND cg.is_active = true
                 FOR UPDATE`,
                [groupId]
            );

            if (!groupResult.rows.length) {
                throw { status: HTTP_STATUS.NOT_FOUND, message: 'Groupe introuvable ou inactif' };
            }

            const group = groupResult.rows[0];
            if (group.school_id !== schoolId) {
                throw { status: HTTP_STATUS.FORBIDDEN, message: 'Ce groupe appartient a une autre ecole' };
            }

            if (group.module_niveau !== student.niveau) {
                throw {
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: `Niveau incompatible. Groupe reserve au niveau ${group.module_niveau}`
                };
            }

            const slotConflict = await client.query(
                `SELECT DISTINCT sge.module_id
                 FROM student_group_enrollments sge
                 JOIN course_group_slots existing_slots ON existing_slots.group_id = sge.group_id
                 JOIN course_group_slots target_slots ON target_slots.group_id = $1
                 WHERE sge.student_id = $2
                   AND sge.status = 'ACTIVE'
                   AND sge.module_id <> $3
                   AND existing_slots.day_of_week = target_slots.day_of_week
                   AND existing_slots.start_time < target_slots.end_time
                   AND target_slots.start_time < existing_slots.end_time
                 LIMIT 1`,
                [group.id, student.id, group.module_id]
            );

            if (slotConflict.rows.length > 0) {
                throw {
                    status: HTTP_STATUS.CONFLICT,
                    message: 'Conflit horaire avec un autre groupe deja reserve'
                };
            }

            const capacityResult = await client.query(
                `SELECT COUNT(*)::int AS count_active
                 FROM student_group_enrollments
                 WHERE group_id = $1
                   AND status = 'ACTIVE'`,
                [group.id]
            );

            const countActive = capacityResult.rows[0].count_active;
            if (countActive >= group.capacity) {
                throw { status: HTTP_STATUS.CONFLICT, message: 'Groupe sature. Aucune place disponible.' };
            }

            const enrollmentResult = await client.query(
                `INSERT INTO student_group_enrollments (student_id, module_id, group_id, status)
                 VALUES ($1, $2, $3, 'ACTIVE')
                 ON CONFLICT (student_id, module_id)
                 DO UPDATE SET group_id = EXCLUDED.group_id,
                               status = 'ACTIVE',
                               updated_at = CURRENT_TIMESTAMP
                 RETURNING id, student_id, module_id, group_id, status, enrolled_at, updated_at`,
                [student.id, group.module_id, group.id]
            );

            await client.query(
                `INSERT INTO etudiant_module_enrollment (etudiant_id, module_id, status)
                 VALUES ($1, $2, 'ACTIVE')
                 ON CONFLICT (etudiant_id, module_id)
                 DO UPDATE SET status = 'ACTIVE',
                               enrolled_at = CURRENT_TIMESTAMP`,
                [student.id, group.module_id]
            );

            const communitySlug = slugFromModuleCode(group.module_code);
            const community = await client.query(
                `SELECT id FROM communities WHERE slug = $1`,
                [communitySlug]
            );

            if (community.rows.length > 0) {
                await client.query(
                    `INSERT INTO community_members (community_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (community_id, user_id) DO NOTHING`,
                    [community.rows[0].id, student.id]
                );
            }

            return {
                enrollment: enrollmentResult.rows[0],
                module: {
                    id: group.module_id,
                    code: group.module_code,
                    nom: group.module_nom,
                    niveau: group.module_niveau
                },
                group: {
                    id: group.id,
                    name: group.group_name,
                    formateur_id: group.formateur_id,
                    formateur_nom: group.formateur_nom,
                    formateur_prenom: group.formateur_prenom
                }
            };
        });
    }

    async getStudentGroupEnrollments({ studentId }) {
        const result = await query(
            `SELECT sge.id,
                    sge.status,
                    sge.enrolled_at,
                    sge.updated_at,
                    m.id AS module_id,
                    m.code AS module_code,
                    m.nom AS module_nom,
                    m.niveau AS module_niveau,
                    cg.id AS group_id,
                    cg.group_name,
                    u.id AS formateur_id,
                    u.nom AS formateur_nom,
                    u.prenom AS formateur_prenom
             FROM student_group_enrollments sge
             JOIN modules m ON m.id = sge.module_id
             JOIN course_groups cg ON cg.id = sge.group_id
             JOIN users u ON u.id = cg.formateur_id
             WHERE sge.student_id = $1
               AND sge.status = 'ACTIVE'
             ORDER BY m.code`,
            [studentId]
        );

        return result.rows;
    }
}

module.exports = new EnrollmentWorkflowService();
