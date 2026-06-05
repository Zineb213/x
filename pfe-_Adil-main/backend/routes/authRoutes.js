// routes/authRoutes.js
const express = require('express');
const { login, googleLogin, getMe, resolveSchoolForRegistration, studentRegister } = require('../controllers/authController');
const { forgotPassword, resetPassword } = require('../controllers/passwordController');
const authenticate = require('../middlewares/authMiddleware');

const router = express.Router();

// Auth endpoints
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/schools/resolve', resolveSchoolForRegistration);
router.post('/student-register', studentRegister);
router.get('/me', authenticate, getMe);

// Password reset endpoints
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
