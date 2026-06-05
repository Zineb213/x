const authService = require('../services/authService');
const googleAuthService = require('../services/googleAuthService');
const StudentRegistration = require('../models/StudentRegistration');
const schoolLevelService = require('../services/schoolLevelService');
const { HTTP_STATUS } = require('../config/constants');

const login = async (req, res, next) => {
  try {
    const { matricule, identifier, password } = req.body;
    const loginId = matricule || identifier;

    if (!loginId || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Matricule ou email et mot de passe sont requis'
      });
    }

    const result = await authService.loginWithMatricule(loginId, password);
    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Google token is required'
      });
    }

    const result = await googleAuthService.loginOrCreateWithGoogle(token);
    res.status(HTTP_STATUS.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(HTTP_STATUS.OK).json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
};

const resolveSchoolForRegistration = async (req, res, next) => {
  try {
    const schoolCode = req.query.code;
    const { school, levels } = await schoolLevelService.resolveSchoolAndLevels(schoolCode);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        school_id: school.id,
        school_name: school.name,
        school_code: school.code,
        is_active: school.is_active,
        levels
      }
    });
  } catch (error) {
    next(error);
  }
};

const studentRegister = async (req, res, next) => {
  try {
    const { email, nom, prenom, niveau, password, school_code } = req.body;

    if (!email || !nom || !prenom || !niveau || !password || !school_code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Email, nom, prenom, niveau, mot de passe et code ecole sont requis'
      });
    }

    const { school } = await schoolLevelService.resolveSchoolAndLevels(school_code);
    await schoolLevelService.ensureLevelAllowedForSchool({ schoolId: school.id, niveau });

    if (password.length < 6) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 6 caracteres'
      });
    }

    const request = await StudentRegistration.createRequest({
      email,
      nom,
      prenom,
      niveau,
      password,
      school_code
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: request,
      message: 'Demande envoyee. Un administrateur doit valider votre inscription.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, googleLogin, getMe, resolveSchoolForRegistration, studentRegister };
