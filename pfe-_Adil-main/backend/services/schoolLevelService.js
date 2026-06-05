const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');

class SchoolLevelService {
    async resolveSchoolByCode(schoolCode) {
        const normalizedCode = typeof schoolCode === 'string' ? schoolCode.trim().toUpperCase() : '';

        if (!normalizedCode) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Le code ecole est requis' };
        }

        const schoolResult = await query(
            `SELECT id, name, code, is_active
             FROM schools
             WHERE UPPER(code) = $1
             LIMIT 1`,
            [normalizedCode]
        );

        if (schoolResult.rows.length === 0) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Code ecole invalide' };
        }

        return schoolResult.rows[0];
    }

    async getSchoolLevels(schoolId) {
        const result = await query(
                        `SELECT DISTINCT TRIM(m.niveau::text) AS niveau
             FROM modules m
             WHERE m.school_id = $1
               AND m.niveau IS NOT NULL
                             AND TRIM(m.niveau::text) <> ''
                         ORDER BY TRIM(m.niveau::text)`,
            [schoolId]
        );

        return result.rows.map((row) => row.niveau);
    }

    async resolveSchoolAndLevels(schoolCode) {
        const school = await this.resolveSchoolByCode(schoolCode);
        const levels = await this.getSchoolLevels(school.id);

        return {
            school,
            levels
        };
    }

    async ensureLevelAllowedForSchool({ schoolId, niveau }) {
        const normalizedLevel = typeof niveau === 'string' ? niveau.trim() : '';
        if (!normalizedLevel) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Le niveau est requis' };
        }

        const levels = await this.getSchoolLevels(schoolId);
        if (levels.length === 0) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'Aucun niveau n est encore configure pour cette ecole'
            };
        }

        if (!levels.includes(normalizedLevel)) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'Niveau invalide pour cette ecole'
            };
        }

        return normalizedLevel;
    }
}

module.exports = new SchoolLevelService();
