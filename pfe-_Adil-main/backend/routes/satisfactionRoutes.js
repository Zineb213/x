const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
    createSurvey,
    listMySurveysAsStudent,
    submitSurveyResponse,
    getSurveyResults
} = require('../controllers/satisfactionController');

const router = express.Router();

router.use(authenticate);

router.post('/surveys', requireRole(['ADMIN', 'FORMATEUR']), createSurvey);
router.get('/surveys/:id/results', requireRole(['ADMIN', 'FORMATEUR']), getSurveyResults);

router.get('/student/surveys', requireRole(['ETUDIANT']), listMySurveysAsStudent);
router.post('/student/surveys/:id/respond', requireRole(['ETUDIANT']), submitSurveyResponse);

module.exports = router;
