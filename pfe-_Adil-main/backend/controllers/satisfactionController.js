const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');
const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');

const createSurvey = async (req, res, next) => {
    try {
        const { moduleId, title, description } = req.body;

        if (!moduleId || !title) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'moduleId et title sont requis'
            });
        }

        if (req.user.role_global === 'FORMATEUR') {
            const isPrimary = await Assignment.isPrimaryFormateur(req.user.id, moduleId);
            if (!isPrimary) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Seul le formateur principal du module peut créer une enquête de satisfaction'
                });
            }
        }

        if (req.user.role_global === 'FORMATEUR_SIMPLE') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Un formateur simple ne peut pas créer une enquête de satisfaction'
            });
        }

        const result = await query(
            `INSERT INTO satisfaction_surveys (module_id, title, description, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [moduleId, title, description || null, req.user.id]
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result.rows[0],
            message: 'Enquête de satisfaction créée'
        });
    } catch (error) {
        next(error);
    }
};

const listMySurveysAsStudent = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT s.id, s.module_id, s.title, s.description, s.is_active,
                    s.created_at, m.code as module_code, m.nom as module_nom,
                    EXISTS (
                        SELECT 1 FROM satisfaction_responses r
                        WHERE r.survey_id = s.id AND r.student_id = $1
                    ) as already_responded
             FROM satisfaction_surveys s
             JOIN modules m ON m.id = s.module_id
             JOIN etudiant_module_enrollment e ON e.module_id = s.module_id
             WHERE e.etudiant_id = $1
               AND e.status = 'ACTIVE'
               AND s.is_active = true
             ORDER BY s.created_at DESC`,
            [req.user.id]
        );

        res.status(HTTP_STATUS.OK).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

const submitSurveyResponse = async (req, res, next) => {
    try {
        const surveyId = parseInt(req.params.id, 10);
        const { rating, comment } = req.body;

        if (!rating || Number(rating) < 1 || Number(rating) > 5) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'rating doit être entre 1 et 5'
            });
        }

        const surveyResult = await query(
            `SELECT id, module_id, is_active FROM satisfaction_surveys WHERE id = $1`,
            [surveyId]
        );

        if (surveyResult.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Enquête introuvable'
            });
        }

        const survey = surveyResult.rows[0];
        if (!survey.is_active) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Cette enquête est fermée'
            });
        }

        const isEnrolled = await Enrollment.isEnrolled(req.user.id, survey.module_id);
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Vous devez être inscrit au module pour répondre'
            });
        }

        const result = await query(
            `INSERT INTO satisfaction_responses (survey_id, student_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (survey_id, student_id)
             DO UPDATE SET rating = EXCLUDED.rating,
                           comment = EXCLUDED.comment,
                           created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [surveyId, req.user.id, Number(rating), comment || null]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: 'Réponse enregistrée'
        });
    } catch (error) {
        next(error);
    }
};

const getSurveyResults = async (req, res, next) => {
    try {
        const surveyId = parseInt(req.params.id, 10);

        const surveyResult = await query(
            `SELECT s.*, m.code as module_code, m.nom as module_nom
             FROM satisfaction_surveys s
             JOIN modules m ON m.id = s.module_id
             WHERE s.id = $1`,
            [surveyId]
        );

        if (surveyResult.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Enquête introuvable'
            });
        }

        const survey = surveyResult.rows[0];

        if (req.user.role_global === 'FORMATEUR') {
            const isPrimary = await Assignment.isPrimaryFormateur(req.user.id, survey.module_id);
            if (!isPrimary) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Seul le formateur principal du module peut consulter ce rapport'
                });
            }
        } else if (req.user.role_global !== 'ADMIN') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Accès refusé'
            });
        }

        const stats = await query(
            `SELECT
                COUNT(*)::int as total_responses,
                COALESCE(ROUND(AVG(rating)::numeric, 2), 0) as average_rating,
                COUNT(*) FILTER (WHERE rating = 1)::int as rating_1,
                COUNT(*) FILTER (WHERE rating = 2)::int as rating_2,
                COUNT(*) FILTER (WHERE rating = 3)::int as rating_3,
                COUNT(*) FILTER (WHERE rating = 4)::int as rating_4,
                COUNT(*) FILTER (WHERE rating = 5)::int as rating_5
             FROM satisfaction_responses
             WHERE survey_id = $1`,
            [surveyId]
        );

        const comments = await query(
            `SELECT r.comment, r.rating, r.created_at
             FROM satisfaction_responses r
             WHERE r.survey_id = $1
               AND r.comment IS NOT NULL
               AND LENGTH(TRIM(r.comment)) > 0
             ORDER BY r.created_at DESC
             LIMIT 100`,
            [surveyId]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                survey,
                stats: stats.rows[0],
                comments: comments.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createSurvey,
    listMySurveysAsStudent,
    submitSurveyResponse,
    getSurveyResults
};
