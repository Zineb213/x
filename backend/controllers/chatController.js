const pool = require('../config/database');

// Helper : vérifier si un user est membre d'un chat (PRV ou GRP)
async function isChatMember(chatId, userId) {
    // Chat privé
    const prv = await pool.query(
        `SELECT 1 FROM chat_prv WHERE chat_id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
        [chatId, userId]
    );
    if (prv.rows.length > 0) return true;
    // Chat groupe
    const grp = await pool.query(
        `SELECT 1 FROM chat_grp_membre WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
    );
    return grp.rows.length > 0;
}

// Lister les chats de l'utilisateur connecté
const getMyChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Chats privés
        const prvChats = await pool.query(`
            SELECT c.id, 'PRV' AS chat_type,
                   CASE WHEN cp.user_a_id = $1 THEN ua2.nom || ' ' || ua2.prenom
                        ELSE ua1.nom || ' ' || ua1.prenom END AS nom,
                   m.content AS dernier_message,
                   m.created_at AS dernier_message_at
            FROM chat_prv cp
            JOIN chat c ON c.id = cp.chat_id
            JOIN app_user ua1 ON ua1.id = cp.user_a_id
            JOIN app_user ua2 ON ua2.id = cp.user_b_id
            LEFT JOIN LATERAL (
                SELECT content, created_at FROM message
                WHERE chat_id = c.id AND is_deleted = false
                ORDER BY created_at DESC LIMIT 1
            ) m ON true
            WHERE cp.user_a_id = $1 OR cp.user_b_id = $1
            ORDER BY COALESCE(m.created_at, c.created_at) DESC
        `, [userId]);

        // Chats groupes
        const grpChats = await pool.query(`
            SELECT c.id, 'GRP' AS chat_type, cg.nom,
                   m.content AS dernier_message,
                   m.created_at AS dernier_message_at
            FROM chat_grp_membre cgm
            JOIN chat_grp cg ON cg.chat_id = cgm.chat_id
            JOIN chat c ON c.id = cg.chat_id
            LEFT JOIN LATERAL (
                SELECT content, created_at FROM message
                WHERE chat_id = c.id AND is_deleted = false
                ORDER BY created_at DESC LIMIT 1
            ) m ON true
            WHERE cgm.user_id = $1
            ORDER BY COALESCE(m.created_at, c.created_at) DESC
        `, [userId]);

        const all = [...prvChats.rows, ...grpChats.rows]
            .sort((a, b) => new Date(b.dernier_message_at || 0) - new Date(a.dernier_message_at || 0));

        res.json(all);
    } catch (err) {
        console.error('Erreur getMyChats:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Créer un groupe de chat
const createGroupChat = async (req, res) => {
    try {
        const { nom } = req.body;
        const userId = req.user.id;

        const chat = await pool.query(
            `INSERT INTO chat (chat_type, created_at, created_by) VALUES ('GRP', NOW(), $1) RETURNING *`,
            [userId]
        );
        const chatId = chat.rows[0].id;

        await pool.query(
            `INSERT INTO chat_grp (chat_id, nom, created_by) VALUES ($1, $2, $3)`,
            [chatId, nom, userId]
        );
        await pool.query(
            `INSERT INTO chat_grp_admin (chat_id, user_id) VALUES ($1, $2)`,
            [chatId, userId]
        );
        await pool.query(
            `INSERT INTO chat_grp_membre (chat_id, user_id, joined_at) VALUES ($1, $2, NOW())`,
            [chatId, userId]
        );

        res.status(201).json({ message: 'Groupe créé', chat: { id: chatId, nom, chat_type: 'GRP' } });
    } catch (err) {
        console.error('Erreur createGroupChat:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Ouvrir/récupérer une conversation privée
const getOrCreatePrivateChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { other_user_id } = req.body;

        // Vérifier si chat privé existe déjà (indépendant de l'ordre a/b)
        const existing = await pool.query(`
            SELECT chat_id FROM chat_prv
            WHERE LEAST(user_a_id, user_b_id) = LEAST($1, $2)
              AND GREATEST(user_a_id, user_b_id) = GREATEST($1, $2)
        `, [userId, other_user_id]);

        if (existing.rows.length > 0) {
            return res.json({ chat_id: existing.rows[0].chat_id, created: false });
        }

        const chat = await pool.query(
            `INSERT INTO chat (chat_type, created_at, created_by) VALUES ('PRV', NOW(), $1) RETURNING *`,
            [userId]
        );
        const chatId = chat.rows[0].id;

        await pool.query(
            `INSERT INTO chat_prv (chat_id, user_a_id, user_b_id) VALUES ($1, $2, $3)`,
            [chatId, userId, other_user_id]
        );

        res.status(201).json({ chat_id: chatId, created: true });
    } catch (err) {
        console.error('Erreur getOrCreatePrivateChat:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Récupérer les messages d'un chat
const getChatMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;

        if (!(await isChatMember(id, userId))) {
            return res.status(403).json({ error: 'Vous n\'êtes pas membre de ce chat' });
        }

        const result = await pool.query(`
            SELECT m.*, u.nom, u.prenom, u.photo_url
            FROM message m
            JOIN app_user u ON m.auteur_id = u.id
            WHERE m.chat_id = $1 AND m.is_deleted = false
            ORDER BY m.created_at ASC
            LIMIT $2 OFFSET $3
        `, [id, limit, offset]);

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getChatMessages:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Envoyer un message
const sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!(await isChatMember(id, userId))) {
            return res.status(403).json({ error: 'Vous n\'êtes pas membre de ce chat' });
        }

        const BANNED_WORDS = ['insulte', 'spam', 'inapproprié'];
        if (BANNED_WORDS.some(w => content.toLowerCase().includes(w))) {
            return res.status(400).json({ error: 'Message contient des mots interdits' });
        }

        const result = await pool.query(
            `INSERT INTO message (chat_id, auteur_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [id, userId, content]
        );

        res.status(201).json({ message: 'Message envoyé', data: result.rows[0] });
    } catch (err) {
        console.error('Erreur sendMessage:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Supprimer un message
const deleteMessage = async (req, res) => {
    try {
        const { id, msgId } = req.params;
        const userId = req.user.id;

        const msg = await pool.query('SELECT * FROM message WHERE id = $1', [msgId]);
        if (msg.rows.length === 0) return res.status(404).json({ error: 'Message non trouvé' });

        if (msg.rows[0].auteur_id !== userId && req.user.role_global === 'USER') {
            return res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce message' });
        }

        await pool.query('UPDATE message SET is_deleted = true WHERE id = $1', [msgId]);
        res.json({ message: 'Message supprimé' });
    } catch (err) {
        console.error('Erreur deleteMessage:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Ajouter membre à un groupe
const addMemberToGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;
        const userId = req.user.id;

        // Vérifier que le demandeur est admin du groupe
        const isAdmin = await pool.query(
            `SELECT 1 FROM chat_grp_admin WHERE chat_id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (isAdmin.rows.length === 0 && req.user.role_global !== 'ADMIN_GLOBAL') {
            return res.status(403).json({ error: 'Vous devez être admin du groupe' });
        }

        await pool.query(
            `INSERT INTO chat_grp_membre (chat_id, user_id, joined_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
            [id, user_id]
        );

        res.json({ message: 'Membre ajouté au groupe' });
    } catch (err) {
        console.error('Erreur addMemberToGroup:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

module.exports = { getMyChats, createGroupChat, getOrCreatePrivateChat, getChatMessages, sendMessage, deleteMessage, addMemberToGroup };
