const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Toujours recuperer le role actuel en base (token potentiellement ancien)
        const userResult = await pool.query(
            'SELECT id, email, role_global FROM app_user WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur introuvable' });
        }

        req.user = {
            id: userResult.rows[0].id,
            email: userResult.rows[0].email,
            role_global: userResult.rows[0].role_global
        };
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalide' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role_global !== 'ADMIN_GLOBAL') {
        return res.status(403).json({ error: 'Accès refusé - Admin requis' });
    }
    next();
};

const moderatorMiddleware = (req, res, next) => {
    if (req.user.role_global !== 'ADMIN_GLOBAL' && req.user.role_global !== 'MODERATEUR') {
        return res.status(403).json({ error: 'Accès refusé - Modérateur/Admin requis' });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware, moderatorMiddleware };
