// services/passwordService.js
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const emailService = require('./emailService');
const { HTTP_STATUS } = require('../config/constants');

class PasswordService {
    async requestPasswordReset(identifier) {
        // Find user by email or matricule
        let user = await User.findByEmail(identifier);
        if (!user) {
            user = await User.findByMatricule(identifier);
        }
        
        if (!user) {
            // For security, don't reveal if user exists
            return { success: true, message: 'If an account exists, a reset link will be sent' };
        }

        // Check if user is a Google OAuth user (no password)
        if (user.google_id && !user.password_hash) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'This account uses Google login. Please sign in with Google.'
            };
        }

        // Create reset token
        const resetToken = await PasswordResetToken.create(user.id);
        
        // Send email
        await emailService.sendPasswordResetEmail(
            user.email,
            user.nom,
            user.prenom,
            resetToken.token
        );
        
        return {
            success: true,
            message: 'Password reset link has been sent to your email',
            // Only include token in development for testing
            ...(process.env.NODE_ENV === 'development' && { dev_token: resetToken.token })
        };
    }

    async resetPassword(token, newPassword) {
        // Validate password strength
        if (newPassword.length < 6) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'Password must be at least 6 characters long'
            };
        }
        
        // Find valid token
        const resetToken = await PasswordResetToken.findByToken(token);
        
        if (!resetToken) {
            throw {
                status: HTTP_STATUS.BAD_REQUEST,
                message: 'Invalid or expired reset token'
            };
        }
        
        // Hash new password
        const hashedPassword = await User.hashPassword(newPassword);
        
        // Update user password
        await User.updatePassword(resetToken.user_id, hashedPassword);
        
        // Mark token as used
        await PasswordResetToken.markAsUsed(resetToken.id);
        
        // Delete any other expired tokens
        await PasswordResetToken.deleteExpiredTokens();
        
        return {
            success: true,
            message: 'Password has been reset successfully'
        };
    }
}

module.exports = new PasswordService();
