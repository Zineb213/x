// routes/adminRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');
const {
    createStudent,
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
    getModuleResources,
    deleteUser,
    deleteModule,
    updateModule,
    deleteAssignment,
    deleteEnrollment,
    updateFormateur,    
    updateStudent,      
    updateAssignment
} = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

// User management
router.post('/students', createStudent);
router.post('/formateurs', createFormateur);
router.post('/modules', createModule);
router.get('/modules', getAllModules);
router.get('/modules/:moduleId/resources', getModuleResources);
router.delete('/modules/:id', deleteModule);
router.put('/modules/:id', updateModule);
router.post('/assignments', assignFormateurToModule);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStatistics);
router.post('/users/reset-password', resetUserPassword);
router.get('/users/password-status', getAllUsersWithPasswordStatus);
router.get('/student-registrations', getStudentRegistrations);
router.post('/student-registrations/:id/approve', approveStudentRegistration);
router.post('/student-registrations/:id/reject', rejectStudentRegistration);

// Enrollment management
router.post('/enrollments', enrollStudent);
router.delete('/enrollments', unenrollStudent);
router.get('/enrollments', getAllEnrollments);
router.post('/students/niveau', setStudentNiveau);
router.get('/assignments', getAllAssignments);
router.post('/course-groups', createCourseGroup);
router.get('/course-groups', getCourseGroups);
router.post('/course-groups/:groupId/slots', addCourseGroupSlot);
router.delete('/assignments/:id', deleteAssignment);
router.delete('/enrollments/:id', deleteEnrollment);
router.put('/formateurs/:id', updateFormateur);
router.put('/students/:id', updateStudent);
router.put('/assignments/:id', updateAssignment);
module.exports = router;
