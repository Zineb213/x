const pool = require('../config/database');

// Récupérer les notifications de l'utilisateur
const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT * FROM notification
            WHERE destinataire_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getMyNotifications:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Compter les notifications non lues
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            'SELECT COUNT(*) FROM notification WHERE destinataire_id = $1 AND is_read = false',
            [userId]
        );

        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error('Erreur getUnreadCount:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Marquer une notification comme lue
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query(
            'UPDATE notification SET is_read = true WHERE id = $1 AND destinataire_id = $2',
            [id, userId]
        );

        res.json({ message: 'Notification marquée comme lue' });
    } catch (err) {
        console.error('Erreur markAsRead:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Marquer toutes les notifications comme lues
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await pool.query(
            'UPDATE notification SET is_read = true WHERE destinataire_id = $1 AND is_read = false',
            [userId]
        );

        res.json({ message: 'Toutes les notifications marquées comme lues' });
    } catch (err) {
        console.error('Erreur markAllAsRead:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead };
