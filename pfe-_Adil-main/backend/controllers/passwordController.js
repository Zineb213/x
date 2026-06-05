// controllers/passwordController.js
const passwordService = require('../services/passwordService');
const { HTTP_STATUS } = require('../config/constants');

const forgotPassword = async (req, res, next) => {
    try {
        const { identifier } = req.body;
        
        if (!identifier) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Email or matricule is required'
            });
        }
        
        const result = await passwordService.requestPasswordReset(identifier);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: result.message,
            ...(result.dev_token && { dev_token: result.dev_token })
        });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, new_password } = req.body;
        
        if (!token || !new_password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Token and new password are required'
            });
        }
        
        const result = await passwordService.resetPassword(token, new_password);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    forgotPassword,
    resetPassword
};
