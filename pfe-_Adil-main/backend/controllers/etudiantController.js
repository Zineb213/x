// controllers/etudiantController.js
const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');
const Enrollment = require('../models/Enrollment');
const Resource = require('../models/Resource');
const Module = require('../models/Module');
const Conversation = require('../models/Conversation');
const progressService = require('../services/progressService');
const { askOllama } = require('../services/ollamaService');
const enrollmentWorkflowService = require('../services/enrollmentWorkflowService');
const LiveSession = require('../models/LiveSession');
const schoolLevelService = require('../services/schoolLevelService');


// Get enrolled modules (filtered by community membership)
const getMyModules = async (req, res, next) => {
    try {
        // Get communities the student has joined
        const joinedCommunities = await query(`
            SELECT c.category_id 
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.user_id = $1
        `, [req.user.id]);
        
        const joinedCategoryIds = joinedCommunities.rows.map(c => c.category_id);
        
        if (joinedCategoryIds.length === 0) {
            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                data: [],
                message: 'Join a community to access modules'
            });
        }
        
        // Fix: Correct parameter placement
        const placeholders = joinedCategoryIds.map((_, i) => `$${i + 2}`).join(',');
        const result = await query(`
            SELECT m.*, c.name as category_name
            FROM etudiant_module_enrollment e
            JOIN modules m ON e.module_id = m.id
            JOIN categories c ON m.category_id = c.id
            WHERE e.etudiant_id = $1
            AND e.status = 'ACTIVE'
            AND m.category_id IN (${placeholders})
            ORDER BY m.code
        `, [req.user.id, ...joinedCategoryIds]);
        
        res.status(HTTP_STATUS.OK).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

// Resources for modules the student is enrolled in (no academic level filter)
const getMyResources = async (req, res, next) => {
    try {
        const resourcesResult = await query(
            `SELECT r.*, m.nom as module_nom, m.code as module_code
             FROM ressource_pedagogique r
             JOIN modules m ON r.module_id = m.id
             JOIN etudiant_module_enrollment e ON e.module_id = m.id
             WHERE e.etudiant_id = $1
               AND e.status = 'ACTIVE'
               AND r.approval_status = 'APPROVED'
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );

        const resources = resourcesResult.rows;
        res.status(HTTP_STATUS.OK).json({ success: true, data: resources });
    } catch (error) {
        next(error);
    }
};

// Download resource (with community membership check)
const downloadResource = async (req, res, next) => {
    try {
        const { id } = req.params;
        const path = require('path');
        
        const resource = await Resource.findById(id);
        if (!resource) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Resource not found'
            });
        }

        if (resource.approval_status !== 'APPROVED') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Cette ressource n\'est pas encore validée'
            });
        }
        
        const isEnrolled = await Enrollment.isEnrolled(req.user.id, resource.module_id);
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Acces refuse. Vous devez etre inscrit a ce module.'
            });
        }
        
        await Resource.incrementDownloadCount(id);
        
        const filePath = path.resolve(resource.file_path);
        res.download(filePath, resource.file_name);
    } catch (error) {
        next(error);
    }
};

// Update profile
const updateProfile = async (req, res, next) => {
    try {
        const { nom, prenom } = req.body;
        
        const result = await query(
            `UPDATE users SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom), updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 RETURNING id, email, nom, prenom, role_global, niveau`,
            [nom, prenom, req.user.id]
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: 'Profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Select academic level
const selectNiveau = async (req, res, next) => {
    try {
        const { niveau } = req.body;

        const normalizedNiveau = await schoolLevelService.ensureLevelAllowedForSchool({
            schoolId: req.user.school_id,
            niveau
        });
        
        const result = await query(
            `UPDATE users SET niveau = $1, onboarding_completed = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING id, email, nom, prenom, niveau`,
            [normalizedNiveau, req.user.id]
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: `Niveau ${normalizedNiveau} selected successfully`
        });
    } catch (error) {
        next(error);
    }
};

// Get formateur for a module
const getModuleFormateur = async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        
        const isEnrolled = await Enrollment.isEnrolled(req.user.id, moduleId);
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You are not enrolled in this module'
            });
        }
        
        const result = await query(
            `SELECT u.id, u.matricule, u.email, u.nom, u.prenom
             FROM formateur_module_assignment fma
             JOIN users u ON fma.formateur_id = u.id
             WHERE fma.module_id = $1
             ORDER BY (fma.assignment_type = 'PRINCIPAL') DESC, fma.assigned_at ASC
             LIMIT 1`,
            [moduleId]
        );
        
        if (result.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'No formateur assigned'
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

const getModuleFormateurs = async (req, res, next) => {
    try {
        const { moduleId } = req.params;

        const isEnrolled = await Enrollment.isEnrolled(req.user.id, moduleId);
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You are not enrolled in this module'
            });
        }

        const result = await query(
            `SELECT u.id, u.matricule, u.email, u.nom, u.prenom, u.role_global,
                    fma.assignment_type, fma.component_scope
             FROM formateur_module_assignment fma
             JOIN users u ON fma.formateur_id = u.id
             WHERE fma.module_id = $1
             ORDER BY (fma.assignment_type = 'PRINCIPAL') DESC, fma.assigned_at ASC`,
            [moduleId]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get or create chat with formateur
const getOrCreateChatWithFormateur = async (req, res, next) => {
    try {
        const { formateurId, moduleId } = req.body;
        
        const isEnrolled = await Enrollment.isEnrolled(req.user.id, moduleId);
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You are not enrolled in this module'
            });
        }
        
        let conversation = await Conversation.findPrivateConversation(req.user.id, formateurId);
        
        if (!conversation) {
            conversation = await Conversation.createPrivate(req.user.id, formateurId);
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        next(error);
    }
};

// Get student badges
const getMyBadges = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT b.*, sb.earned_at 
            FROM badges b
            LEFT JOIN student_badges sb ON b.id = sb.badge_id AND sb.student_id = $1
            ORDER BY b.xp_required ASC
        `, [req.user.id]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get student progress
const getMyProgress = async (req, res, next) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN resource_id END) as completed_resources,
                COUNT(DISTINCT resource_id) as total_resources,
                COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN module_id END) as completed_modules,
                COUNT(DISTINCT module_id) as total_modules
            FROM student_progress 
            WHERE student_id = $1
        `, [req.user.id]);
        
        const level = await query(`
            SELECT current_level, total_xp
            FROM users 
            WHERE id = $1
        `, [req.user.id]);

        const totalXp = parseInt(level.rows[0]?.total_xp, 10) || 0;
        const rank = progressService.getExpertTrackRank(totalXp);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                stats: stats.rows[0] || { completed_resources: 0, total_resources: 0, completed_modules: 0, total_modules: 0 },
                level: level.rows[0] || { current_level: 1, total_xp: 0 },
                rank
            }
        });
    } catch (error) {
        next(error);
    }
};

const getRecentResources = async (req, res, next) => {
    try {
        const result = await query(`
                        SELECT r.*, m.nom as module_nom, m.code as module_code, c.name as category_name,
                                     uploader.nom as uploader_nom, uploader.prenom as uploader_prenom,
                                     approver.nom as approver_nom, approver.prenom as approver_prenom
            FROM ressource_pedagogique r
            JOIN modules m ON r.module_id = m.id
            LEFT JOIN categories c ON m.category_id = c.id
                        LEFT JOIN users uploader ON uploader.id = r.uploaded_by
                        LEFT JOIN users approver ON approver.id = r.approved_by
            JOIN etudiant_module_enrollment e
              ON e.module_id = m.id AND e.etudiant_id = $1 AND e.status = 'ACTIVE'
                        WHERE r.approval_status = 'APPROVED'
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [req.user.id]);
        
        // FIXED: Changed HTTP_STATUS_OK to HTTP_STATUS.OK
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const completeResource = async (req, res, next) => {
    try {
        const { resourceId, moduleId } = req.body;

        if (!resourceId || !moduleId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'resourceId and moduleId are required'
            });
        }

        const resource = await Resource.findById(parseInt(resourceId, 10));
        if (!resource) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Ressource introuvable'
            });
        }

        if (parseInt(resource.module_id, 10) !== parseInt(moduleId, 10)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'moduleId ne correspond pas a la ressource'
            });
        }

        const isEnrolled = await Enrollment.isEnrolled(req.user.id, parseInt(moduleId, 10));
        if (!isEnrolled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Acces refuse. Vous devez etre inscrit a ce module.'
            });
        }

        const result = await progressService.completeResource(
            req.user.id,
            parseInt(resourceId, 10),
            parseInt(moduleId, 10)
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, error: error.message });
        }
        next(error);
    }
};

const getEnrollmentOptions = async (req, res, next) => {
    try {
        const requestedNiveau = typeof req.query.niveau === 'string' ? req.query.niveau.trim().toUpperCase() : '';
        const niveau = requestedNiveau || req.user.niveau;

        if (!niveau) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Niveau requis. Selectionnez votre niveau d abord.'
            });
        }

        const validNiveaux = ['L1', 'L2', 'L3', 'M1', 'M2'];
        if (!validNiveaux.includes(niveau)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Niveau invalide'
            });
        }

        const modules = await enrollmentWorkflowService.listModulesByNiveau({
            schoolId: req.user.school_id,
            niveau,
            studentId: req.user.id
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                niveau,
                modules
            }
        });
    } catch (error) {
        return next(error);
    }
};

const getModuleFormateursWithGroups = async (req, res, next) => {
    try {
        const moduleId = parseInt(req.params.moduleId, 10);
        if (Number.isNaN(moduleId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'moduleId invalide'
            });
        }

        const moduleData = await Module.findById(moduleId);
        if (!moduleData || moduleData.school_id !== req.user.school_id) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Module introuvable pour votre ecole'
            });
        }

        const formateurs = await enrollmentWorkflowService.listFormateursByModule({
            schoolId: req.user.school_id,
            moduleId
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                module: {
                    id: moduleData.id,
                    code: moduleData.code,
                    nom: moduleData.nom,
                    niveau: moduleData.niveau
                },
                formateurs
            }
        });
    } catch (error) {
        return next(error);
    }
};

const getFormateurScheduleForModule = async (req, res, next) => {
    try {
        const formateurId = parseInt(req.params.formateurId, 10);
        const moduleId = parseInt(req.query.moduleId, 10);

        if (Number.isNaN(formateurId) || Number.isNaN(moduleId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'formateurId et moduleId sont requis'
            });
        }

        const groups = await enrollmentWorkflowService.getFormateurSchedule({
            schoolId: req.user.school_id,
            moduleId,
            formateurId
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: groups
        });
    } catch (error) {
        return next(error);
    }
};

const reserveGroupEnrollment = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.groupId, 10);
        if (Number.isNaN(groupId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'groupId invalide'
            });
        }

        const reservation = await enrollmentWorkflowService.reserveGroupForStudent({
            schoolId: req.user.school_id,
            studentId: req.user.id,
            groupId
        });

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: reservation,
            message: 'Reservation de groupe confirmee'
        });
    } catch (error) {
        return next(error);
    }
};

const getMyGroupEnrollments = async (req, res, next) => {
    try {
        const enrollments = await enrollmentWorkflowService.getStudentGroupEnrollments({
            studentId: req.user.id
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: enrollments
        });
    } catch (error) {
        return next(error);
    }
};

const getSchoolAiCapability = async (schoolId) => {
    if (!schoolId) {
        return {
            enabled: false,
            reason: 'Aucune ecole associee a ce compte.',
            schoolName: null,
            planName: null
        };
    }

    const result = await query(
        `SELECT s.name AS school_name,
                sp.plan_name,
                COALESCE(sp.ai_enabled, false) AS ai_enabled
         FROM schools s
         LEFT JOIN subscription_plans sp ON sp.id = s.subscription_plan_id
         WHERE s.id = $1`,
        [schoolId]
    );

    if (result.rows.length === 0) {
        return {
            enabled: false,
            reason: 'Ecole introuvable.',
            schoolName: null,
            planName: null
        };
    }

    const row = result.rows[0];
    const enabled = Boolean(row.ai_enabled);

    return {
        enabled,
        reason: enabled ? null : 'Assistant IA desactive pour votre ecole (abonnement sans IA).',
        schoolName: row.school_name,
        planName: row.plan_name || null
    };
};

const getAssistantStatus = async (req, res, next) => {
    try {
        const capability = await getSchoolAiCapability(req.user.school_id);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                ai_enabled: capability.enabled,
                message: capability.reason,
                school_name: capability.schoolName,
                plan_name: capability.planName
            }
        });
    } catch (error) {
        return next(error);
    }
};

const askAssistant = async (req, res, next) => {
    try {
        if (req.user.role_global !== 'ETUDIANT') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Assistant IA reserve aux apprenants'
            });
        }

        const capability = await getSchoolAiCapability(req.user.school_id);
        if (!capability.enabled) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: capability.reason || 'Assistant IA desactive pour votre ecole.'
            });
        }

        const { question, moduleId } = req.body;

        if (!question || typeof question !== 'string' || !question.trim()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Question invalide'
            });
        }

        const trimmedQuestion = question.trim();
        if (trimmedQuestion.length > 1500) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Question trop longue (max 1500 caracteres)'
            });
        }

        let contextText = '';

        if (moduleId) {
            const moduleIdNum = parseInt(moduleId, 10);
            if (Number.isNaN(moduleIdNum)) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'moduleId invalide'
                });
            }

            const isEnrolled = await Enrollment.isEnrolled(req.user.id, moduleIdNum);
            if (!isEnrolled) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous n\'etes pas inscrit dans ce module'
                });
            }

            const moduleResult = await query(
                `SELECT id, code, nom, description, components FROM modules WHERE id = $1`,
                [moduleIdNum]
            );

            const moduleData = moduleResult.rows[0];
            if (moduleData) {
                const resourcesResult = await query(
                    `SELECT titre, description, category
                     FROM ressource_pedagogique
                     WHERE module_id = $1 AND approval_status = 'APPROVED'
                     ORDER BY created_at DESC
                     LIMIT 10`,
                    [moduleIdNum]
                );

                const resourcesSummary = resourcesResult.rows
                    .map((r, idx) => `${idx + 1}. ${r.titre}${r.category ? ` [${r.category}]` : ''}${r.description ? ` - ${r.description}` : ''}`)
                    .join('\n');

                contextText = [
                    `Module: ${moduleData.code} - ${moduleData.nom}`,
                    moduleData.description ? `Description: ${moduleData.description}` : '',
                    Array.isArray(moduleData.components) && moduleData.components.length > 0
                        ? `Composants: ${moduleData.components.join(', ')}`
                        : '',
                    resourcesSummary ? `Ressources recentes:\n${resourcesSummary}` : 'Aucune ressource recente disponible.'
                ].filter(Boolean).join('\n');
            }
        }

        const systemPrompt = [
            'Tu es un assistant pedagogique pour des etudiants universitaires.',
            'Reponds en francais clair et concis.',
            'Si une information officielle manque, dis-le explicitement et conseille de contacter le formateur.',
            'N\'invente jamais des dates, notes ou regles administratives.',
            'Reste dans le contexte du module quand il est fourni.'
        ].join(' ');

        const result = await askOllama({
            systemPrompt,
            userMessage: trimmedQuestion,
            contextText
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            data: {
                answer: result.answer,
                model: result.model,
                hasContext: Boolean(contextText)
            }
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(HTTP_STATUS.GATEWAY_TIMEOUT).json({
                success: false,
                error: 'Assistant IA indisponible (timeout Ollama)'
            });
        }

        if (error.message && error.message.includes('Ollama')) {
            return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
                success: false,
                error: 'Assistant IA indisponible. Verifiez que Ollama est lance.'
            });
        }

        return next(error);
    }
};

module.exports = {
    getMyModules,
    getMyResources,
    downloadResource,
    updateProfile,
    selectNiveau,
    getModuleFormateur,
    getModuleFormateurs,
    getOrCreateChatWithFormateur,
    getMyBadges,
    getMyProgress,
    getRecentResources,
    completeResource,
    getEnrollmentOptions,
    getModuleFormateursWithGroups,
    getFormateurScheduleForModule,
    reserveGroupEnrollment,
    getMyGroupEnrollments,
    getAssistantStatus,
    askAssistant,
    getActiveLives
};

async function getActiveLives(req, res, next) {
    try {
        const lives = await LiveSession.findActiveForStudent(req.user.id);
        res.status(HTTP_STATUS.OK).json({ success: true, data: lives });
    } catch (error) {
        next(error);
    }
}