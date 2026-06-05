// controllers/adminController.js
const adminService = require('../services/adminService');
const User = require('../models/User');
const Resource = require('../models/Resource');
const StudentRegistration = require('../models/StudentRegistration');
const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');
const enrollmentWorkflowService = require('../services/enrollmentWorkflowService');

const createStudent = async (req, res, next) => {
    try {
        const { email, nom, prenom, password } = req.body;

        if (!email || !nom || !prenom || !password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Email, nom, prénom et mot de passe sont requis'
            });
        }

        if (password.length < 6) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }

        const student = await adminService.createStudent({
            email,
            nom,
            prenom,
            password
        }, req.user.school_id || null);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: student,
            message: `Étudiant créé. Matricule: ${student.matricule} — connexion possible avec le matricule ou l’email.`
        });
    } catch (error) {
        next(error);
    }
};

const createFormateur = async (req, res, next) => {
    try {
        const { email, nom, prenom, password } = req.body;
        
        if (!email || !nom || !prenom || !password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'All fields are required'
            });
        }
        
        const formateur = await adminService.createFormateur({
            email,
            nom,
            prenom,
            password
        }, req.user.school_id || null);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: formateur,
            message: `Formateur created. Matricule: ${formateur.matricule}`
        });
    } catch (error) {
        next(error);
    }
};

const createModule = async (req, res, next) => {
    try {
        const { code, nom, components } = req.body;
        
        if (!code || !nom) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Code et nom sont requis'
            });
        }

        if (components !== undefined) {
            if (!Array.isArray(components) || components.length === 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'components doit être une liste non vide'
                });
            }
        }
        
        const module = await adminService.createModule(req.body, req.user.id, req.user.school_id || null);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: module
        });
    } catch (error) {
        next(error);
    }
};
const getModuleResources = async (req, res, next) => {
    try {
        const moduleId = parseInt(req.params.moduleId, 10);
        const resources = await Resource.findByModule(moduleId);
        res.status(HTTP_STATUS.OK).json({ success: true, data: resources });
    } catch (error) {
        next(error);
    }
};

const getAllModules = async (req, res, next) => {
    try {
        const Module = require('../models/Module');
        const modules = await Module.findAll(req.user.school_id || null);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: modules
        });
    } catch (error) {
        next(error);
    }
};             

const assignFormateurToModule = async (req, res, next) => {
    try {
        const { formateurId, moduleId, assignmentType, componentScope } = req.body;
        
        if (!formateurId || !moduleId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'formateurId and moduleId are required'
            });
        }
        
        const assignment = await adminService.assignFormateurToModule(formateurId, moduleId, req.user.id, {
            assignmentType,
            componentScope
        }, req.user.school_id || null);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const users = await adminService.getAllUsers(req.user.school_id || null);
        res.status(HTTP_STATUS.OK).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

const getStatistics = async (req, res, next) => {
    try {
        const stats = await adminService.getStatistics(req.user.school_id || null);
        res.status(HTTP_STATUS.OK).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

const resetUserPassword = async (req, res, next) => {
    try {
        const { userId, newPassword } = req.body;
        
        // Validate inputs
        if (!userId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'User ID is required'
            });
        }
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'New password must be at least 6 characters long'
            });
        }
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // ✅ CRITICAL FIX: Hash the password properly
        const hashedPassword = await User.hashPassword(newPassword);
        
        // Update password
        await User.updatePassword(userId, hashedPassword);
        
        // Delete any existing reset tokens
        await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Password reset successfully for user: ${user.nom} ${user.prenom}`,
            data: {
                userId: user.id,
                email: user.email,
                matricule: user.matricule,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role_global
            }
        });
        
    } catch (error) {
        next(error);
    }
};

const getAllUsersWithPasswordStatus = async (req, res, next) => {
    try {
        const params = [];
        const schoolFilter = req.user.school_id
            ? (params.push(req.user.school_id), 'WHERE school_id = $1')
            : '';

        const result = await query(`
            SELECT 
                id, 
                matricule, 
                email, 
                nom, 
                prenom, 
                role_global, 
                niveau,
                school_id,
                is_active,
                CASE 
                    WHEN password_hash IS NOT NULL THEN 'Yes'
                    WHEN google_id IS NOT NULL THEN 'Google OAuth'
                    ELSE 'No'
                END as password_status,
                created_at
            FROM users 
            ${schoolFilter}
            ORDER BY role_global, nom, prenom
        `, params);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        next(error);
    }
};

const getStudentRegistrations = async (req, res, next) => {
    try {
        const { status } = req.query;
        const requests = await StudentRegistration.getAll(status || null, req.user.school_id || null);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: requests
        });
    } catch (error) {
        next(error);
    }
};

const approveStudentRegistration = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const { niveau } = req.body || {};
        if (Number.isNaN(requestId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'ID de demande invalide'
            });
        }

        const createdUser = await StudentRegistration.approve(
            requestId,
            req.user.id,
            req.user.school_id || null,
            niveau || null
        );
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: createdUser,
            message: 'Inscription etudiant acceptee'
        });
    } catch (error) {
        next(error);
    }
};

const rejectStudentRegistration = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        if (Number.isNaN(requestId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'ID de demande invalide'
            });
        }

        const { reason } = req.body || {};
        const rejected = await StudentRegistration.reject(requestId, req.user.id, reason || null);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: rejected,
            message: 'Inscription etudiant refusee'
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// NEW FUNCTIONS FOR ENROLLMENT
// =============================================

const enrollStudent = async (req, res, next) => {
    try {
        const { etudiantId, moduleId } = req.body;
        
        if (!etudiantId || !moduleId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'etudiantId and moduleId are required'
            });
        }
        
        const enrollment = await adminService.enrollStudent(etudiantId, moduleId, req.user.id, req.user.school_id || null);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: enrollment,
            message: 'Student enrolled successfully'
        });
    } catch (error) {
        next(error);
    }
};

const unenrollStudent = async (req, res, next) => {
    try {
        const { etudiantId, moduleId } = req.body;
        
        if (!etudiantId || !moduleId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'etudiantId and moduleId are required'
            });
        }
        
        const result = await adminService.unenrollStudent(etudiantId, moduleId, req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result,
            message: 'Student unenrolled successfully'
        });
    } catch (error) {
        next(error);
    }
};

const getAllEnrollments = async (req, res, next) => {
    try {
        const enrollments = await adminService.getAllEnrollments(req.user.school_id || null);
        res.status(HTTP_STATUS.OK).json({ success: true, data: enrollments });
    } catch (error) {
        next(error);
    }
};

const setStudentNiveau = async (req, res, next) => {
    try {
        const { etudiantId, niveau } = req.body;
        
        if (!etudiantId || !niveau) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'etudiantId and niveau are required'
            });
        }
        
        const validNiveaux = ['L1', 'L2', 'L3', 'M1', 'M2'];
        if (!validNiveaux.includes(niveau)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Invalid niveau. Must be L1, L2, L3, M1, or M2'
            });
        }
        
        const student = await adminService.setStudentNiveau(etudiantId, niveau, req.user.id, req.user.school_id || null);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: student,
            message: 'Student niveau updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

const createCourseGroup = async (req, res, next) => {
    try {
        const { moduleId, formateurId, groupName, capacity } = req.body;

        if (!moduleId || !formateurId || !groupName) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'moduleId, formateurId et groupName sont requis'
            });
        }

        const capacityValue = Number(capacity || 30);
        if (!Number.isInteger(capacityValue) || capacityValue <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'capacity doit etre un entier positif'
            });
        }

        const group = await enrollmentWorkflowService.createCourseGroup({
            schoolId: req.user.school_id,
            moduleId: Number(moduleId),
            formateurId: Number(formateurId),
            groupName,
            capacity: capacityValue
        });

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: group,
            message: 'Groupe cree avec succes'
        });
    } catch (error) {
        return next(error);
    }
};

const addCourseGroupSlot = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.groupId, 10);
        const { dayOfWeek, startTime, endTime } = req.body;

        if (Number.isNaN(groupId) || !dayOfWeek || !startTime || !endTime) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'groupId, dayOfWeek, startTime et endTime sont requis'
            });
        }

        const day = Number(dayOfWeek);
        if (!Number.isInteger(day) || day < 1 || day > 7) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'dayOfWeek doit etre entre 1 et 7'
            });
        }

        const slot = await enrollmentWorkflowService.addGroupSlot({
            schoolId: req.user.school_id,
            groupId,
            dayOfWeek: day,
            startTime,
            endTime
        });

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: slot,
            message: 'Creneau ajoute au groupe'
        });
    } catch (error) {
        return next(error);
    }
};

const getCourseGroups = async (req, res, next) => {
    try {
        const moduleId = req.query.moduleId ? Number(req.query.moduleId) : null;
        const formateurId = req.query.formateurId ? Number(req.query.formateurId) : null;

        const groups = await enrollmentWorkflowService.listCourseGroups({
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


const getAllAssignments = async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        const params = [];
        const where = req.user.school_id
            ? (params.push(req.user.school_id), 'WHERE m.school_id = $1')
            : '';

        const result = await query(`
            SELECT 
                fma.id,
                fma.formateur_id,
                fma.module_id,
                fma.assignment_type,
                fma.component_scope,
                fma.assigned_at,
                u.role_global,
                u.nom as formateur_nom,
                u.prenom as formateur_prenom,
                u.matricule as formateur_matricule,
                m.code as module_code,
                m.nom as module_nom,
                m.niveau as module_niveau,
                m.components as module_components
            FROM formateur_module_assignment fma
            JOIN users u ON fma.formateur_id = u.id
            JOIN modules m ON fma.module_id = m.id
            ${where}
            ORDER BY fma.assigned_at DESC
        `, params);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};
// Delete user (soft delete - deactivate)
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'User not found'
            });
        }

        if (req.user.school_id && user.school_id !== req.user.school_id) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Cannot manage users from another school'
            });
        }
        
        // Prevent deleting yourself
        if (parseInt(id) === req.user.id) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'You cannot delete your own account'
            });
        }
        
        // Soft delete - set is_active to false
        const { query } = require('../config/database');
        await query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Delete module
const deleteModule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const Module = require('../models/Module');
        
        const module = await Module.findById(id);
        if (!module) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Module not found'
            });
        }

        if (req.user.school_id && module.school_id !== req.user.school_id) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'Cannot manage modules from another school'
            });
        }
        
        await Module.delete(id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Module deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Update module
const updateModule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, description, credits, coeff, components } = req.body;
        const Module = require('../models/Module');
        
        const module = await Module.findById(id);
        if (!module) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Module not found'
            });
        }
        
        let normalizedComponents;
        if (components !== undefined) {
            if (!Array.isArray(components) || components.length === 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'components doit être une liste non vide'
                });
            }
            normalizedComponents = [...new Set(
                components
                    .map((c) => (typeof c === 'string' ? c.trim() : ''))
                    .filter((c) => c.length > 0)
            )];
            if (normalizedComponents.length === 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'components doit contenir au moins une valeur valide'
                });
            }
        }

        const updatedModule = await Module.update(id, { nom, description, credits, coeff, components: normalizedComponents });
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: updatedModule,
            message: 'Module updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Delete assignment
const deleteAssignment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const Assignment = require('../models/Assignment');
        
        // Get assignment details to know formateurId and moduleId
        const { query } = require('../config/database');
        const assignment = await query(`SELECT formateur_id, module_id FROM formateur_module_assignment WHERE id = $1`, [id]);
        
        if (assignment.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Assignment not found'
            });
        }
        
        await Assignment.removeAssignment(assignment.rows[0].formateur_id, assignment.rows[0].module_id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Assignment removed successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Delete enrollment
const deleteEnrollment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const Enrollment = require('../models/Enrollment');
        
        const { query } = require('../config/database');
        const enrollment = await query(`SELECT etudiant_id, module_id FROM etudiant_module_enrollment WHERE id = $1`, [id]);
        
        if (enrollment.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Enrollment not found'
            });
        }
        
        await Enrollment.unenroll(enrollment.rows[0].etudiant_id, enrollment.rows[0].module_id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Enrollment removed successfully'
        });
    } catch (error) {
        next(error);
    }
};
// Update formateur
const updateFormateur = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, prenom, email } = req.body;
        
        // Check if user exists and is a formateur
        const user = await User.findById(id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'User not found'
            });
        }
        
        if (!['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(user.role_global)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'User is not a formateur'
            });
        }
        
        // Update user
        const { query } = require('../config/database');
        const result = await query(
            `UPDATE users 
             SET nom = COALESCE($1, nom), 
                 prenom = COALESCE($2, prenom), 
                 email = COALESCE($3, email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING id, matricule, email, nom, prenom, role_global`,
            [nom, prenom, email, id]
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: 'Formateur updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Update student (nom, prenom, email)
const updateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nom, prenom, email } = req.body;
        
        // Check if user exists and is a student
        const user = await User.findById(id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'User not found'
            });
        }
        
        if (user.role_global !== 'ETUDIANT') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'User is not a student'
            });
        }
        
        // Update user
        const { query } = require('../config/database');
        const result = await query(
            `UPDATE users 
             SET nom = COALESCE($1, nom), 
                 prenom = COALESCE($2, prenom), 
                 email = COALESCE($3, email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING id, matricule, email, nom, prenom, role_global, niveau`,
            [nom, prenom, email, id]
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0],
            message: 'Student updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Update assignment (change module for formateur)
const updateAssignment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { moduleId } = req.body;
        
        // Get current assignment
        const { query } = require('../config/database');
        const currentAssignment = await query(
            `SELECT formateur_id, module_id, assignment_type, component_scope FROM formateur_module_assignment WHERE id = $1`,
            [id]
        );
        
        if (currentAssignment.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Assignment not found'
            });
        }
        
        // Recreate on target module first, then remove previous assignment.
        // This prevents accidental assignment loss if target validation fails.
        const Assignment = require('../models/Assignment');
        const oldModuleId = currentAssignment.rows[0].module_id;
        const targetModuleId = Number(moduleId);

        const newAssignment = await adminService.assignFormateurToModule(
            currentAssignment.rows[0].formateur_id,
            targetModuleId,
            req.user.id,
            {
                assignmentType: currentAssignment.rows[0].assignment_type,
                componentScope: currentAssignment.rows[0].component_scope
            }
        );

        if (oldModuleId !== targetModuleId) {
            await Assignment.removeAssignment(currentAssignment.rows[0].formateur_id, oldModuleId);
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: newAssignment,
            message: 'Assignment updated successfully'
                   });

 }  catch (error) {
        next(error);
    }
};


       
      


// =============================================
// EXPORTS - MAKE SURE ALL FUNCTIONS ARE INCLUDED
// =============================================

module.exports = {
    createStudent,
    getModuleResources,
    createFormateur,
    createModule,
    assignFormateurToModule,
    getAllUsers,
    getStatistics,
    resetUserPassword,
    getAllUsersWithPasswordStatus,
    getStudentRegistrations,
    approveStudentRegistration,
    rejectStudentRegistration,
    enrollStudent,
    unenrollStudent,
    getAllEnrollments,
    setStudentNiveau,
    getAllAssignments,
    createCourseGroup,
    addCourseGroupSlot,
    getCourseGroups,
    getAllModules,
    deleteUser,  
    deleteModule, 
    updateModule, 
    deleteAssignment,
    deleteEnrollment,
    updateFormateur,
    updateStudent,
    updateAssignment
};
