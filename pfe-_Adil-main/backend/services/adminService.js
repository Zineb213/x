// services/adminService.js
const User = require('../models/User');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const { generateMatricule } = require('../utils/matriculeGenerator');
const { slugFromModuleCode } = require('../utils/moduleCommunitySlug');
const schoolLevelService = require('./schoolLevelService');
const { HTTP_STATUS, ROLES } = require('../config/constants');
const { query } = require('../config/database');

class AdminService {
    normalizeComponents(components) {
        const fallback = ['Cours', 'TD', 'TP'];
        if (!Array.isArray(components)) return fallback;
        const normalized = [...new Set(
            components
                .map((c) => (typeof c === 'string' ? c.trim() : ''))
                .filter((c) => c.length > 0)
        )];
        return normalized.length > 0 ? normalized : fallback;
    }

    async createFormateur(userData, schoolId = null) {
        const { email, nom, prenom, password } = userData;
        
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw { status: HTTP_STATUS.CONFLICT, message: 'Email already exists' };
        }
        
        const matricule = await generateMatricule();
        const hashedPassword = await User.hashPassword(password);
        
        const user = await User.create({
            matricule,
            email,
            password_hash: hashedPassword,
            nom,
            prenom,
            role_global: ROLES.FORMATEUR,
            niveau: null,
            school_id: schoolId
        });
        
        return user;
    }

    async createStudent(userData, schoolId = null) {
        const { email, nom, prenom, password } = userData;

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw { status: HTTP_STATUS.CONFLICT, message: 'Email already exists' };
        }

        const matricule = await generateMatricule();
        const hashedPassword = await User.hashPassword(password);

        const user = await User.create({
            matricule,
            email,
            password_hash: hashedPassword,
            nom,
            prenom,
            role_global: ROLES.ETUDIANT,
            niveau: null,
            school_id: schoolId
        });

        return user;
    }
    
    async createModule(moduleData, adminId, schoolId = null) {
        const { code, nom, description, credits, coeff, components, niveau } = moduleData;
        const normalizedComponents = this.normalizeComponents(components);
        const niveauDb = niveau || 'L1';

        const module = await Module.create({
            code,
            nom,
            description,
            niveau: niveauDb,
            credits: credits || 0,
            coeff: coeff || 1.0,
            created_by: adminId,
            components: normalizedComponents,
            school_id: schoolId
        });

        return module;
    }
    
    async assignFormateurToModule(formateurId, moduleId, adminId, options = {}, schoolId = null) {
        const { assignmentType = 'SIMPLE', componentScope } = options;
        const formateur = await User.findById(formateurId);
        if (!formateur || ![ROLES.FORMATEUR, ROLES.FORMATEUR_SIMPLE].includes(formateur.role_global)) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Invalid formateur' };
        }
        
        const module = await Module.findById(moduleId);
        if (!module) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'Invalid module' };
        }

        if (schoolId && (formateur.school_id !== schoolId || module.school_id !== schoolId)) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Cross-school assignment is not allowed' };
        }

        if (!['PRINCIPAL', 'SIMPLE'].includes(assignmentType)) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'assignmentType doit être PRINCIPAL ou SIMPLE'
            };
        }

        const currentPrimary = await Assignment.getPrimaryByModule(moduleId);
        if (assignmentType === 'PRINCIPAL' && currentPrimary && currentPrimary.formateur_id !== Number(formateurId)) {
            throw {
                status: HTTP_STATUS.CONFLICT,
                message: `Ce module a déjà un chargé de formation: ${currentPrimary.prenom} ${currentPrimary.nom}`
            };
        }

        if (assignmentType === 'SIMPLE' && !currentPrimary) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'Affectez d\'abord un chargé de formation au module avant un formateur simple'
            };
        }

        const allowedComponents = Array.isArray(module.components) && module.components.length > 0
            ? module.components
            : ['Cours', 'TD', 'TP'];
        let normalizedScope = null;

        if (assignmentType === 'SIMPLE') {
            const provided = Array.isArray(componentScope) ? componentScope : [];
            normalizedScope = [...new Set(provided.filter((c) => allowedComponents.includes(c)))];
            if (normalizedScope.length === 0) {
                throw {
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: `Pour un formateur simple, choisissez au moins un composant: ${allowedComponents.join(', ')}`
                };
            }
        }
        
        const assignment = await Assignment.assign(formateurId, moduleId, adminId, assignmentType, normalizedScope);
        
        // Create a community for this module if it doesn't exist
        const communityName = `${module.code} - ${module.nom}`;
        const communitySlug = slugFromModuleCode(module.code);
        
        // Check if community already exists
        const existingCommunity = await query(`SELECT id FROM communities WHERE slug = $1`, [communitySlug]);
        
        if (existingCommunity.rows.length === 0) {
            await query(`
                INSERT INTO communities (name, slug, description, category_id, created_by)
                VALUES ($1, $2, $3, $4, $5)
            `, [communityName, communitySlug, `Communauté pour le module ${module.nom}`, module.category_id, adminId]);
            
            console.log(`✅ Created community for module: ${module.code}`);
        }
        
        return assignment;
    }
    
    async getAllUsers(schoolId = null) {
        const users = schoolId ? await User.findAllBySchool(schoolId) : await User.findAll();
        return users;
    }
    
    async getStatistics(schoolId = null) {
        const users = schoolId ? await User.findAllBySchool(schoolId) : await User.findAll();
        const modules = await Module.findAll(schoolId);
        
        return {
            totalUsers: users.length,
            totalAdmins: users.filter(u => u.role_global === ROLES.ADMIN).length,
            totalFormateurs: users.filter(u => [ROLES.FORMATEUR, ROLES.FORMATEUR_SIMPLE].includes(u.role_global)).length,
            totalEtudiants: users.filter(u => u.role_global === ROLES.ETUDIANT).length,
            totalModules: modules.length
        };
    }

    async enrollStudent(etudiantId, moduleId, adminId, schoolId = null) {
        const student = await User.findById(etudiantId);
        if (!student) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Student not found' };
        }
        if (student.role_global !== ROLES.ETUDIANT) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'User is not a student' };
        }
        
        const module = await Module.findById(moduleId);
        if (!module) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Module not found' };
        }

        if (schoolId && (student.school_id !== schoolId || module.school_id !== schoolId)) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Cross-school enrollment is not allowed' };
        }
        
        const isEnrolled = await Enrollment.isEnrolled(etudiantId, moduleId);
        if (isEnrolled) {
            throw { status: HTTP_STATUS.CONFLICT, message: 'Student already enrolled in this module' };
        }
        
        const enrollment = await Enrollment.enroll(etudiantId, moduleId);
        
        // Auto-join student to module community
        const communitySlug = slugFromModuleCode(module.code);
        const community = await query(`SELECT id FROM communities WHERE slug = $1`, [communitySlug]);
        
        if (community.rows.length > 0) {
            await query(`
                INSERT INTO community_members (community_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (community_id, user_id) DO NOTHING
            `, [community.rows[0].id, etudiantId]);
            
            console.log(`✅ Auto-enrolled student to community: ${communitySlug}`);
        }
        
        return enrollment;
    }
    
    async unenrollStudent(etudiantId, moduleId, adminId) {
        const isEnrolled = await Enrollment.isEnrolled(etudiantId, moduleId);
        if (!isEnrolled) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Student is not enrolled in this module' };
        }
        
        const result = await Enrollment.unenroll(etudiantId, moduleId);
        return result;
    }
    
    async getAllEnrollments(schoolId = null) {
        const rows = await Enrollment.getAllEnrollments();
        if (!schoolId) return rows;
        return rows.filter((r) => r.school_id === schoolId || r.module_school_id === schoolId || r.student_school_id === schoolId);
    }
    
    async setStudentNiveau(etudiantId, niveau, adminId, schoolId = null) {
        const student = await User.findById(etudiantId);
        if (!student) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Student not found' };
        }
        if (student.role_global !== ROLES.ETUDIANT) {
            throw { status: HTTP_STATUS.BAD_REQUEST, message: 'User is not a student' };
        }

        if (schoolId && student.school_id !== schoolId) {
            throw { status: HTTP_STATUS.FORBIDDEN, message: 'Cannot update student from another school' };
        }
        
        const finalSchoolId = schoolId || student.school_id;
        const normalizedNiveau = await schoolLevelService.ensureLevelAllowedForSchool({
            schoolId: finalSchoolId,
            niveau
        });
        
        const result = await query(
            `UPDATE users SET niveau = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING id, email, nom, prenom, niveau, role_global`,
            [normalizedNiveau, etudiantId]
        );
        
        if (result.rows.length === 0) {
            throw { status: HTTP_STATUS.NOT_FOUND, message: 'Failed to update student niveau' };
        }
        
        return result.rows[0];
    }
}

module.exports = new AdminService();
