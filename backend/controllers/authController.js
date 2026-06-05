const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Register - Créer un nouvel utilisateur
const register = async (req, res) => {
    try {
        const { nom, prenom, matricule, email, password } = req.body;

        // Vérifier si l'utilisateur existe
        const existUser = await pool.query(
            'SELECT * FROM app_user WHERE matricule = $1 OR email = $2',
            [matricule, email]
        );

        if (existUser.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Utilisateur déjà existant' });
        }

        // Hasher le password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Déterminer le rôle selon le matricule
        let role_global = 'USER';
        if (matricule.startsWith('admin')) role_global = 'ADMIN_GLOBAL';
        if (matricule.startsWith('mod')) role_global = 'MODERATEUR';

        // Créer l'utilisateur
        const result = await pool.query(
            `INSERT INTO app_user (username, email, password_hash, nom, prenom, matricule, role_global, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING id, username, email, nom, prenom, matricule, role_global`,
            [email, email, hashedPassword, nom, prenom, matricule, role_global]
        );

        // Créer un JWT
        const token = jwt.sign(
            { id: result.rows[0].id, email: result.rows[0].email, role_global: result.rows[0].role_global },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(201).json({
            success: true,
            data: {
                token,
                user: result.rows[0]
            }
        });
    } catch (err) {
        console.error('Erreur register:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
};

// Login - Authentifier un utilisateur
const login = async (req, res) => {
    try {
        // Support multiple possible field names sent by the frontend:
        // - `identifier` (used by some frontends)
        // - `matricule` (legacy)
        // - `email`
        const identifier = req.body.identifier || req.body.matricule || req.body.email;
        const { password } = req.body;

        // Chercher l'utilisateur (matching matricule OR email)
        const result = await pool.query(
            'SELECT * FROM app_user WHERE matricule = $1 OR email = $1',
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Matricule ou mot de passe incorrect' });
        }

        const user = result.rows[0];

        // Vérifier le password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Matricule ou mot de passe incorrect' });
        }

        // Créer un JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role_global: user.role_global },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    nom: user.nom,
                    prenom: user.prenom,
                    matricule: user.matricule,
                    email: user.email,
                    role_global: user.role_global
                }
            }
        });
    } catch (err) {
        console.error('Erreur login:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
};

// GetProfile - Récupérer le profil de l'utilisateur connecté
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT id, username, email, nom, prenom, matricule, photo_url, bio, role_global, created_at FROM app_user WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Erreur getProfile:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
};

// UpdateProfile - Mettre à jour le profil
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { nom, prenom, bio, photo_url } = req.body;

        const result = await pool.query(
            `UPDATE app_user 
             SET nom = COALESCE($1, nom), 
                 prenom = COALESCE($2, prenom),
                 bio = COALESCE($3, bio),
                 photo_url = COALESCE($4, photo_url)
             WHERE id = $5
             RETURNING id, nom, prenom, email, matricule, bio, photo_url`,
            [nom, prenom, bio, photo_url, userId]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Erreur updateProfile:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
};

module.exports = { register, login, getProfile, updateProfile };
