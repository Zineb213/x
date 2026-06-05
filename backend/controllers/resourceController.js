const pool = require('../config/database');

function toPositiveIntOrNull(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

// Get all resources
const getAllResources = async (req, res) => {
    try {
        const { niveau, module } = req.query;
        let query = 'SELECT * FROM ressource_pedagogique WHERE 1=1';
        const params = [];

        if (niveau) {
            query += ` AND niveau = $${params.length + 1}`;
            params.push(niveau);
        }

        if (module) {
            query += ` AND module = $${params.length + 1}`;
            params.push(module);
        }

        query += ' ORDER BY date_ajout DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getAllResources:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Get single resource
const getResourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM ressource_pedagogique WHERE id_ressource = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ressource non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erreur getResourceById:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Create resource (Admin/Moderator only)
const createResource = async (req, res) => {
    try {
        const {
            titre,
            description,
            niveau,
            module,
            resource_type,
            id_auteur,
            fichier_pdf,
            logo_url,
            url_youtube,
            correction_target,
            nombre_chapitres,
            numero_serie,
            annee,
            session,
            id_examen,
            nombre_videos
        } = req.body;
        const userId = req.user.id;

        if (!titre || !niveau || !module || !resource_type) {
            return res.status(400).json({ error: 'Champs requis manquants pour la ressource' });
        }

        // Vérifier les permissions du modérateur
        if (req.user.role_global === 'MODERATEUR') {
            const hasPerm = await pool.query(
                'SELECT * FROM ressource_moderator WHERE moderator_id = $1 AND module = $2 AND niveau = $3',
                [userId, module, niveau]
            );

            if (hasPerm.rows.length === 0) {
                return res.status(403).json({ error: `Vous ne pouvez pas modifier le module ${module}` });
            }
        }

            const normalizedType = String(resource_type).toUpperCase();
            if (!['COURS', 'TD', 'TP', 'EXAMEN', 'CORRIGE', 'PLAYLIST'].includes(normalizedType)) {
                return res.status(400).json({ error: 'Type de ressource invalide' });
            }
            const normalizedCorrectionTarget = correction_target ? String(correction_target).toUpperCase() : null;
            if (normalizedType === 'CORRIGE' && normalizedCorrectionTarget && !['TD', 'TP', 'EXAMEN'].includes(normalizedCorrectionTarget)) {
                return res.status(400).json({ error: 'correction_target invalide (TD, TP, EXAMEN)' });
            }
        const chapitres = normalizedType === 'COURS' ? (toPositiveIntOrNull(nombre_chapitres) ?? 1) : toPositiveIntOrNull(nombre_chapitres);
        const serie = normalizedType === 'TD' ? (toPositiveIntOrNull(numero_serie) ?? 1) : toPositiveIntOrNull(numero_serie);
        const videos = normalizedType === 'PLAYLIST' ? (toPositiveIntOrNull(nombre_videos) ?? 1) : toPositiveIntOrNull(nombre_videos);

        if (normalizedType === 'PLAYLIST' && !url_youtube) {
            return res.status(400).json({ error: 'Le lien vidéo/playlist est requis pour le type PLAYLIST' });
        }

        const result = await pool.query(
            `INSERT INTO ressource_pedagogique (
                titre, description, niveau, module, resource_type, id_auteur, date_ajout,
                fichier_pdf, logo_url, url_youtube, correction_target, nombre_chapitres, numero_serie, annee, session, id_examen, nombre_videos
            )
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING *`,
            [
                titre,
                description,
                niveau,
                module,
                normalizedType,
                id_auteur || userId,
                fichier_pdf || null,
                logo_url || null,
                url_youtube || null,
                normalizedType === 'CORRIGE' ? normalizedCorrectionTarget : null,
                chapitres,
                serie,
                toPositiveIntOrNull(annee),
                session || null,
                toPositiveIntOrNull(id_examen),
                videos
            ]
        );

        // Log l'action
        await pool.query(
            `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, 'RESSOURCE', result.rows[0].id_ressource, 'CREATE']
        );

        res.status(201).json({ message: 'Ressource créée', resource: result.rows[0] });
    } catch (err) {
        console.error('Erreur createResource:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Update resource
const updateResource = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titre,
            description,
            niveau,
            module,
            fichier_pdf,
            logo_url,
            url_youtube,
            correction_target,
            nombre_chapitres,
            numero_serie,
            annee,
            session,
            id_examen,
            nombre_videos
        } = req.body;
        const userId = req.user.id;

        // Vérifier les permissions du modérateur
        if (req.user.role_global === 'MODERATEUR') {
            const hasPerm = await pool.query(
                'SELECT * FROM ressource_moderator WHERE moderator_id = $1 AND module = $2 AND niveau = $3',
                [userId, module, niveau]
            );

            if (hasPerm.rows.length === 0) {
                return res.status(403).json({ error: `Vous ne pouvez pas modifier ce module` });
            }
        }

        const result = await pool.query(
            `UPDATE ressource_pedagogique 
             SET titre = COALESCE($1, titre), 
                 description = COALESCE($2, description),
                 niveau = COALESCE($3, niveau),
                 module = COALESCE($4, module),
                 fichier_pdf = COALESCE($5, fichier_pdf),
                 logo_url = COALESCE($6, logo_url),
                 url_youtube = COALESCE($7, url_youtube),
                 correction_target = COALESCE($8, correction_target),
                 nombre_chapitres = COALESCE($9, nombre_chapitres),
                 numero_serie = COALESCE($10, numero_serie),
                 annee = COALESCE($11, annee),
                 session = COALESCE($12, session),
                 id_examen = COALESCE($13, id_examen),
                 nombre_videos = COALESCE($14, nombre_videos)
             WHERE id_ressource = $15
             RETURNING *`,
            [
                titre,
                description,
                niveau,
                module,
                fichier_pdf,
                logo_url,
                url_youtube,
                correction_target ? String(correction_target).toUpperCase() : null,
                toPositiveIntOrNull(nombre_chapitres),
                toPositiveIntOrNull(numero_serie),
                toPositiveIntOrNull(annee),
                session,
                toPositiveIntOrNull(id_examen),
                toPositiveIntOrNull(nombre_videos),
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ressource non trouvée' });
        }

        // Log l'action
        await pool.query(
            `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, 'RESSOURCE', id, 'EDIT']
        );

        res.json({ message: 'Ressource mise à jour', resource: result.rows[0] });
    } catch (err) {
        console.error('Erreur updateResource:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Delete/Archive resource
const deleteResource = async (req, res) => {
    try {
        const { id } = req.params;
        const { raison } = req.body;
        const userId = req.user.id;

        const result = await pool.query(
            'UPDATE ressource_pedagogique SET is_archived = true WHERE id_ressource = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ressource non trouvée' });
        }

        // Log l'action
        await pool.query(
            `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, raison, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [userId, 'RESSOURCE', id, 'DELETE', raison]
        );

        res.json({ message: 'Ressource archivée', resource: result.rows[0] });
    } catch (err) {
        console.error('Erreur deleteResource:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

module.exports = { getAllResources, getResourceById, createResource, updateResource, deleteResource };
