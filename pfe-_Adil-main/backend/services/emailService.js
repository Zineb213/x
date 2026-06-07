// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        
        // Check if email configuration exists
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            this.isConfigured = true;
            console.log('✅ Email service configured');
        } else {
            console.log('⚠️ Email service not configured - password reset will show token in console');
        }
    }

    async sendPasswordResetEmail(email, nom, prenom, resetToken) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #6366F1 0%, #14B8A6 100%); color: white; padding: 20px; text-align: center; border-radius: 16px 16px 0 0; }
                    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #14B8A6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                    .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; }
                    .token { background: #e2e8f0; padding: 10px; border-radius: 8px; font-family: monospace; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Réinitialisation du mot de passe</h1>
                    </div>
                    <div class="content">
                        <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
                        <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                        </div>
                        <p>Ou copiez ce lien dans votre navigateur :</p>
                        <p class="token">${resetUrl}</p>
                        <p>Ce lien expirera dans <strong>15 minutes</strong>.</p>
                        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                        <hr>
                        <p><small>TAMKIN - Plateforme Éducative</small></p>
                    </div>
                    <div class="footer">
                        <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const text = `
            Réinitialisation du mot de passe
            
            Bonjour ${prenom} ${nom},
            
            Vous avez demandé la réinitialisation de votre mot de passe.
            
            Cliquez sur le lien suivant pour créer un nouveau mot de passe:
            ${resetUrl}
            
            Ce lien expirera dans 15 minutes.
            
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
            
            ---
            TAMKIN - Plateforme Éducative
        `;
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'noreply@tamkin.com',
            to: email,
            subject: 'TAMKIN - Réinitialisation de votre mot de passe',
            text: text,
            html: html
        };
        
        if (this.isConfigured) {
            try {
                await this.transporter.sendMail(mailOptions);
                console.log(`✅ Password reset email sent to ${email}`);
                return true;
            } catch (error) {
                console.error('❌ Email sending failed:', error.message);
                return false;
            }
        } else {
            // Development mode: log the token
            console.log(`\n📧 DEVELOPMENT MODE - Password Reset Token:`);
            console.log(`   Token: ${resetToken}`);
            console.log(`   Reset URL: ${resetUrl}\n`);
            return true;
        }
    }
}

module.exports = new EmailService();
