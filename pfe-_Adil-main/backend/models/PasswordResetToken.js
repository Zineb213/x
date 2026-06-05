// models/PasswordResetToken.js
const { query } = require('../config/database');
const crypto = require('crypto');

class PasswordResetToken {
    static async create(userId, expiresInMinutes = 15) {
        // Delete any existing tokens for this user
        await query(
            `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = false`,
            [userId]
        );
        
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
        
        const result = await query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, token, expires_at`,
            [userId, token, expiresAt]
        );
        
        return result.rows[0];
    }

    static async findByToken(token) {
        const result = await query(
            `SELECT id, user_id, token, expires_at, used
             FROM password_reset_tokens 
             WHERE token = $1 AND used = false AND expires_at > NOW()`,
            [token]
        );
        return result.rows[0];
    }

    static async markAsUsed(tokenId) {
        await query(
            `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
            [tokenId]
        );
    }
    
    static async deleteExpiredTokens() {
        await query(
            `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = true`
        );
    }
}

module.exports = PasswordResetToken;
