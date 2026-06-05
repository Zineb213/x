const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const { requireSuperAdmin } = require('../middlewares/roleMiddleware');
const {
    createSchool,
    getSchools,
    createSchoolAdmin,
    getOverview,
    getSubscriptionPlans,
    createSubscriptionPlan,
    assignSubscriptionToSchool,
    getPaymentCalendar,
    updateSchoolStatus,
    updateSchoolPayment,
    getAcademicYears,
    createAcademicYear,
    activateAcademicYear
} = require('../controllers/superAdminController');

const router = express.Router();

router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/overview', getOverview);
router.get('/subscription-plans', getSubscriptionPlans);
router.post('/subscription-plans', createSubscriptionPlan);
router.get('/schools', getSchools);
router.get('/payment-calendar', getPaymentCalendar);
router.post('/schools', createSchool);
router.post('/schools/:schoolId/admins', createSchoolAdmin);
router.patch('/schools/:schoolId/subscription', assignSubscriptionToSchool);
router.patch('/schools/:schoolId/status', updateSchoolStatus);
router.patch('/schools/:schoolId/payment', updateSchoolPayment);

router.get('/academic-years', getAcademicYears);
router.post('/academic-years', createAcademicYear);
router.patch('/academic-years/:yearId/activate', activateAcademicYear);

module.exports = router;
