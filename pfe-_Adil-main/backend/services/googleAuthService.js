// services/googleAuthService.js
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { HTTP_STATUS } = require('../config/constants');

class GoogleAuthService {
    constructor() {
        this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    async verifyGoogleToken(token) {
        try {
            const ticket = await this.client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            const payload = ticket.getPayload();
            
            return {
                email: payload.email,
                nom: payload.family_name || '',
                prenom: payload.given_name || '',
                googleId: payload.sub,
                emailVerified: payload.email_verified,
                picture: payload.picture
            };
        } catch (error) {
            console.error('Google verification error:', error.message);
            throw { 
                status: HTTP_STATUS.UNAUTHORIZED, 
                message: 'Google authentication failed: ' + error.message 
            };
        }
    }

    async loginOrCreateWithGoogle(token) {
        try {
            const googleUser = await this.verifyGoogleToken(token);
            
            if (!googleUser.emailVerified) {
                throw { 
                    status: HTTP_STATUS.BAD_REQUEST, 
                    message: 'Email not verified with Google' 
                };
            }

            console.log('Google user info:', {
                email: googleUser.email,
                nom: googleUser.nom,
                prenom: googleUser.prenom,
                googleId: googleUser.googleId
            });

            // 1. Try to find user by google_id
            let user = await User.findByGoogleId(googleUser.googleId);
            
            // 2. If not found by google_id, try by email
            if (!user) {
                user = await User.findByEmail(googleUser.email);
                
                // 2a. If user exists by email but no google_id, UPDATE with google_id
                if (user && !user.google_id) {
                    console.log('Linking Google account to existing user:', user.email);
                    
                    // Update user with google_id
                    const { query } = require('../config/database');
                    await query(
                        `UPDATE users SET google_id = $1 WHERE id = $2`,
                        [googleUser.googleId, user.id]
                    );
                    user.google_id = googleUser.googleId;
                }
            }
            
            // 3. If user still doesn't exist, CREATE new ETUDIANT
            if (!user) {
                console.log('Creating new student account for:', googleUser.email);
                
                user = await User.createFromGoogle(
                    googleUser.email,
                    googleUser.nom || 'Étudiant',
                    googleUser.prenom || 'Nouveau',
                    googleUser.googleId
                );
            }

            // 4. Check if user is active
            if (!user.is_active) {
                throw { 
                    status: HTTP_STATUS.FORBIDDEN, 
                    message: 'Account is disabled. Contact administrator.' 
                };
            }

            // 5. Determine if this is first login and update last login time
            const isFirstLogin = !user.last_login;
            await User.updateLastLogin(user.id);

            // 6. Generate JWT token
            const authToken = generateToken(user);

            // 7. Return user without sensitive data and include first-login flag
            const { password_hash, ...userWithoutPassword } = user;
            return {
                token: authToken,
                user: { ...userWithoutPassword, is_first_login: isFirstLogin }
            };
            
        } catch (error) {
            console.error('Google auth service error:', error);
            throw error;
        }
    }
}

module.exports = new GoogleAuthService();
