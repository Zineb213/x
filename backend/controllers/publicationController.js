const pool = require('../config/database');

const MAX_ATTACHMENT_DATA_LENGTH = 8 * 1024 * 1024; // limite conservative en caracteres data URL

// Lister toutes les publications
const getAllPublications = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   u.nom, u.prenom, u.matricule, u.photo_url,
                   (SELECT COUNT(*) FROM commentaire c WHERE c.publication_id = p.id AND c.is_deleted = false) AS nb_commentaires,
                   (SELECT COUNT(*) FROM vote v WHERE v.publication_id = p.id AND v.type = 'UPVOTE') AS nb_upvotes,
                   (SELECT COUNT(*) FROM vote v WHERE v.publication_id = p.id AND v.type = 'DOWNVOTE') AS nb_downvotes,
                   COALESCE(att.attachments, '[]'::json) AS attachments
            FROM publication p
            JOIN app_user u ON p.auteur_id = u.id
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'file_url', a.file_url,
                        'file_type', a.file_type
                    ) ORDER BY a.id ASC
                ) AS attachments
                FROM attachment a
                WHERE a.publication_id = p.id
            ) att ON true
            WHERE p.is_deleted = false
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getAllPublications:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Créer une publication
const createPublication = async (req, res) => {
    try {
        const { content, attachments = [] } = req.body;
        const userId = req.user.id;
        const cleanedContent = (content || '').trim();

        if (!cleanedContent && (!Array.isArray(attachments) || attachments.length === 0)) {
            return res.status(400).json({ error: 'Le contenu de la publication est requis' });
        }

        const result = await pool.query(
            `INSERT INTO publication (communaute_id, auteur_id, content, created_at)
             VALUES (1, $1, $2, NOW()) RETURNING *`,
            [userId, cleanedContent || 'Publication avec pièce jointe']
        );

        const publicationId = result.rows[0].id;

        if (Array.isArray(attachments) && attachments.length > 0) {
            const safeAttachments = attachments.slice(0, 5);
            for (const file of safeAttachments) {
                const fileUrl = String(file?.data || '').trim();
                if (!fileUrl) continue;

                if (fileUrl.length > MAX_ATTACHMENT_DATA_LENGTH) {
                    return res.status(413).json({
                        error: 'Pièce jointe trop volumineuse. Utilisez un fichier plus léger.'
                    });
                }

                const type = ['IMAGE', 'VIDEO', 'PDF', 'DOCUMENT'].includes(file?.file_type)
                    ? file.file_type
                    : 'DOCUMENT';
                await pool.query(
                    `INSERT INTO attachment (publication_id, file_url, file_type, created_at)
                     VALUES ($1, $2, $3, NOW())`,
                    [publicationId, fileUrl, type]
                );
            }
        }

        // Log activité
        await pool.query(
            `INSERT INTO activity (user_id, type, description, source_type, source_id, date)
             VALUES ($1, 'PUBLICATION', $2, 'PUBLICATION', $3, NOW())`,
            [userId, `Nouvelle publication`, publicationId]
        );

        res.status(201).json({ message: 'Publication créée', publication: result.rows[0] });
    } catch (err) {
        console.error('Erreur createPublication:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Supprimer une publication (auteur ou admin/modérateur)
const deletePublication = async (req, res) => {
    try {
        const { id } = req.params;
        const { raison } = req.body;
        const userId = req.user.id;
        const role = req.user.role_global;

        const pub = await pool.query('SELECT * FROM publication WHERE id = $1', [id]);
        if (pub.rows.length === 0) return res.status(404).json({ error: 'Publication non trouvée' });

        // Vérifier permission
        if (pub.rows[0].auteur_id !== userId && role === 'USER') {
            return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cette publication' });
        }

        await pool.query('UPDATE publication SET is_deleted = true WHERE id = $1', [id]);

        // Log si admin/modérateur
        if (role !== 'USER') {
            await pool.query(
                `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, raison, created_at)
                 VALUES ($1, 'PUBLICATION', $2, 'DELETE', $3, NOW())`,
                [userId, id, raison]
            );
        }

        res.json({ message: 'Publication supprimée' });
    } catch (err) {
        console.error('Erreur deletePublication:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Voter (upvote/downvote)
const votePublication = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // UPVOTE ou DOWNVOTE
        const userId = req.user.id;

        // Vérifier si vote existe déjà
        const existing = await pool.query(
            'SELECT * FROM vote WHERE publication_id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existing.rows.length > 0) {
            if (existing.rows[0].type === type) {
                // Annuler le vote
                await pool.query('DELETE FROM vote WHERE id = $1', [existing.rows[0].id]);
                return res.json({ message: 'Vote annulé' });
            } else {
                // Changer le vote
                await pool.query('UPDATE vote SET type = $1 WHERE id = $2', [type, existing.rows[0].id]);
                return res.json({ message: 'Vote changé' });
            }
        }

        // Nouveau vote
        await pool.query(
            `INSERT INTO vote (publication_id, user_id, type, created_at) VALUES ($1, $2, $3, NOW())`,
            [id, userId, type]
        );

        res.status(201).json({ message: 'Vote enregistré' });
    } catch (err) {
        console.error('Erreur votePublication:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Commenter une publication
const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const result = await pool.query(
            `INSERT INTO commentaire (publication_id, auteur_id, content, created_at)
             VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [id, userId, content]
        );

        // Notifier l'auteur de la publication
        const pub = await pool.query('SELECT auteur_id FROM publication WHERE id = $1', [id]);
        if (pub.rows[0].auteur_id !== userId) {
            await pool.query(
                `INSERT INTO notification (destinataire_id, content, source_type, source_id, created_at)
                 VALUES ($1, $2, 'COMMENTAIRE', $3, NOW())`,
                [pub.rows[0].auteur_id, `Quelqu'un a commenté votre publication`, result.rows[0].id]
            );
        }

        res.status(201).json({ message: 'Commentaire ajouté', commentaire: result.rows[0] });
    } catch (err) {
        console.error('Erreur addComment:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Lister commentaires d'une publication
const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT c.*, u.nom, u.prenom, u.photo_url
            FROM commentaire c
            JOIN app_user u ON c.auteur_id = u.id
            WHERE c.publication_id = $1 AND c.is_deleted = false
            ORDER BY c.created_at ASC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getComments:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Partager une publication
const sharePublication = async (req, res) => {
    try {
        const { id } = req.params;
        const { destinataire_user_id, destinataire_chat_id } = req.body;
        const userId = req.user.id;

        const result = await pool.query(
            `INSERT INTO partage (publication_id, expediteur_id, destinataire_user_id, destinataire_chat_id, created_at)
             VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [id, userId, destinataire_user_id || null, destinataire_chat_id || null]
        );

        // Notifier si partage vers un utilisateur
        if (destinataire_user_id) {
            await pool.query(
                `INSERT INTO notification (destinataire_id, content, source_type, source_id, created_at)
                 VALUES ($1, 'Une publication a été partagée avec vous', 'PARTAGE', $2, NOW())`,
                [destinataire_user_id, result.rows[0].id]
            );
        }

        res.status(201).json({ message: 'Publication partagée', partage: result.rows[0] });
    } catch (err) {
        console.error('Erreur sharePublication:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

module.exports = { getAllPublications, createPublication, deletePublication, votePublication, addComment, getComments, sharePublication };
