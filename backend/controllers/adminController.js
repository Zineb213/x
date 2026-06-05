const pool = require('../config/database');

// Dashboard admin - statistiques globales
const getDashboardStats = async (req, res) => {
    try {
        const [users, resources, publications, messages] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM app_user'),
            pool.query('SELECT COUNT(*) FROM ressource_pedagogique WHERE is_archived = false'),
            pool.query('SELECT COUNT(*) FROM publication WHERE is_deleted = false'),
            pool.query('SELECT COUNT(*) FROM message WHERE is_deleted = false')
        ]);

        res.json({
            total_users: parseInt(users.rows[0].count),
            total_resources: parseInt(resources.rows[0].count),
            total_publications: parseInt(publications.rows[0].count),
            total_messages: parseInt(messages.rows[0].count)
        });
    } catch (err) {
        console.error('Erreur getDashboardStats:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Lister tous les utilisateurs
const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nom, prenom, matricule, email, role_global, created_at FROM app_user ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getAllUsers:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Changer le rôle d'un utilisateur (ADMIN_GLOBAL seulement)
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_global } = req.body;

        const validRoles = ['ADMIN_GLOBAL', 'MODERATEUR', 'USER'];
        if (!validRoles.includes(role_global)) {
            return res.status(400).json({ error: 'Rôle invalide' });
        }

        const result = await pool.query(
            'UPDATE app_user SET role_global = $1 WHERE id = $2 RETURNING id, nom, prenom, matricule, role_global',
            [role_global, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json({ message: 'Rôle mis à jour', user: result.rows[0] });
    } catch (err) {
        console.error('Erreur updateUserRole:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Assigner un module à un modérateur
const assignModuleToModerator = async (req, res) => {
    try {
        const { moderator_id, module, niveau } = req.body;
        const adminId = req.user.id;

        // Vérifier que l'utilisateur existe
        const mod = await pool.query(
            `SELECT id, role_global FROM app_user WHERE id = $1`,
            [moderator_id]
        );

        if (mod.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        // Auto-promouvoir en MODERATEUR si USER
        if (mod.rows[0].role_global === 'USER') {
            await pool.query(
                `UPDATE app_user SET role_global = 'MODERATEUR' WHERE id = $1`,
                [moderator_id]
            );
        }

        await pool.query(
            `INSERT INTO ressource_moderator (moderator_id, module, niveau, assigned_by, assigned_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (moderator_id, module, niveau) DO NOTHING`,
            [moderator_id, module, niveau, adminId]
        );

        res.status(201).json({ message: `Module ${module} (${niveau}) assigné au modérateur` });
    } catch (err) {
        console.error('Erreur assignModuleToModerator:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Lister les modules d'un modérateur
const getModeratorModules = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM ressource_moderator WHERE moderator_id = $1 ORDER BY niveau, module',
            [id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getModeratorModules:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Récupérer le log de modération
const getModerationLog = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ml.*, u.nom, u.prenom, u.matricule
            FROM moderation_log ml
            JOIN app_user u ON ml.moderator_id = u.id
            ORDER BY ml.created_at DESC
            LIMIT 100
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getModerationLog:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Lister les evenements a venir (tous les utilisateurs connectes)
const getUpcoming = async (req, res) => {
    try {
        const { niveau, module } = req.query;
        const params = [];
        let query = `
            SELECT a.id, a.date, a.description, a.user_id, u.nom, u.prenom
            FROM activity a
            JOIN app_user u ON u.id = a.user_id
            WHERE a.source_type = 'UPCOMING' AND a.date >= NOW()
        `;

        if (niveau) {
            query += ` AND a.description::text ILIKE $${params.length + 1}`;
            params.push(`%\"niveau\":\"${niveau}\"%`);
        }

        if (module) {
            query += ` AND a.description::text ILIKE $${params.length + 1}`;
            params.push(`%\"module\":\"${module}\"%`);
        }

        query += ' ORDER BY a.date ASC LIMIT 100';

        const result = await pool.query(query, params);
        const mapped = result.rows.map((row) => {
            let payload = {};
            try {
                payload = JSON.parse(row.description || '{}');
            } catch (_) {
                payload = { title: row.description || 'Evenement' };
            }

            return {
                id: row.id,
                date: row.date,
                user_id: row.user_id,
                created_by: `${row.prenom || ''} ${row.nom || ''}`.trim(),
                title: payload.title || 'Evenement',
                module: payload.module || null,
                niveau: payload.niveau || null,
                location: payload.location || null,
                notes: payload.notes || null,
                logo_url: payload.logo_url || null
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error('Erreur getUpcoming:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Creer un evenement a venir (admin global ou moderateur du module)
const createUpcoming = async (req, res) => {
    try {
        const { title, module, niveau, date, location, notes, logo_url } = req.body;
        const userId = Number(req.user.id);
        const roleGlobal = req.user.role_global;

        if (!title || !module || !niveau || !date) {
            return res.status(400).json({ error: 'title, module, niveau et date sont obligatoires' });
        }

        if (!['L1', 'L2', 'L3'].includes(niveau)) {
            return res.status(400).json({ error: 'Niveau invalide' });
        }

        if (Number.isNaN(new Date(date).getTime())) {
            return res.status(400).json({ error: 'Date invalide' });
        }

        // Autorisation module/niveau pour moderateur
        if (roleGlobal !== 'ADMIN_GLOBAL') {
            const check = await pool.query(
                `SELECT 1 FROM ressource_moderator
                 WHERE moderator_id = $1 AND module = $2 AND niveau = $3
                 LIMIT 1`,
                [userId, module, niveau]
            );

            if (check.rows.length === 0) {
                return res.status(403).json({ error: 'Vous ne pouvez pas ajouter un evenement pour ce module/niveau' });
            }
        }

        const descriptionPayload = JSON.stringify({
            title,
            module,
            niveau,
            location: location || null,
            notes: notes || null,
            logo_url: logo_url || null
        });

        const insert = await pool.query(
            `INSERT INTO activity (user_id, type, date, description, source_type, source_id)
             VALUES ($1, 'AUTRE', $2, $3, 'UPCOMING', NULL)
             RETURNING id, user_id, date, description`,
            [userId, date, descriptionPayload]
        );

        const logTargetId = insert.rows[0].id;
        await pool.query(
            `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, raison, created_at)
             VALUES ($1, 'upcoming', $2, 'CREATE_UPCOMING', $3, NOW())`,
            [userId, logTargetId, `Ajout a venir: ${title} (${module}/${niveau})`]
        );

        res.status(201).json({
            message: 'Evenement a venir cree',
            item: {
                id: insert.rows[0].id,
                user_id: insert.rows[0].user_id,
                date: insert.rows[0].date,
                ...JSON.parse(insert.rows[0].description)
            }
        });
    } catch (err) {
        console.error('Erreur createUpcoming:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Recherche globale
const search = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Requête trop courte' });
        }

        const term = `%${q}%`;

        const [resources, publications, users] = await Promise.all([
            pool.query(
                `SELECT id_ressource AS id, titre, module, niveau, resource_type, 'RESSOURCE' AS type
                 FROM ressource_pedagogique WHERE is_archived = false AND (titre ILIKE $1 OR module ILIKE $1)`,
                [term]
            ),
            pool.query(
                `SELECT p.id, p.content, u.nom, u.prenom, 'PUBLICATION' AS type
                 FROM publication p JOIN app_user u ON p.auteur_id = u.id
                 WHERE p.is_deleted = false AND p.content ILIKE $1`,
                [term]
            ),
            pool.query(
                `SELECT id, nom, prenom, matricule, 'USER' AS type
                 FROM app_user WHERE nom ILIKE $1 OR prenom ILIKE $1 OR matricule ILIKE $1`,
                [term]
            )
        ]);

        res.json({
            query: q,
            results: {
                ressources: resources.rows,
                publications: publications.rows,
                users: users.rows,
                total: resources.rows.length + publications.rows.length + users.rows.length
            }
        });
    } catch (err) {
        console.error('Erreur search:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

const getModulesCatalog = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT mc.id, mc.nom, mc.niveau, mc.description, mc.logo_url, mc.created_at,
                   mc.created_by,
                   COALESCE(r.resource_count, 0) AS resource_count
            FROM module_catalog mc
            LEFT JOIN (
                SELECT module, niveau, COUNT(*)::int AS resource_count
                FROM ressource_pedagogique
                WHERE is_archived = false
                GROUP BY module, niveau
            ) r ON r.module = mc.nom AND r.niveau::text = mc.niveau::text
            ORDER BY mc.niveau, mc.nom
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur getModulesCatalog:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

const createModuleCatalog = async (req, res) => {
    try {
        const { nom, niveau, description, logo_url } = req.body;
        const userId = Number(req.user.id);
        const roleGlobal = req.user.role_global;

        const moduleName = String(nom || '').trim();
        if (!moduleName || !niveau) {
            return res.status(400).json({ error: 'nom et niveau sont obligatoires' });
        }

        if (!['L1', 'L2', 'L3'].includes(String(niveau).toUpperCase())) {
            return res.status(400).json({ error: 'Niveau invalide' });
        }

        // Moderateur: seulement ses modules assignes
        if (roleGlobal !== 'ADMIN_GLOBAL') {
            const check = await pool.query(
                `SELECT 1 FROM ressource_moderator
                 WHERE moderator_id = $1 AND module = $2 AND niveau = $3
                 LIMIT 1`,
                [userId, moduleName, String(niveau).toUpperCase()]
            );
            if (check.rows.length === 0) {
                return res.status(403).json({ error: 'Vous ne pouvez pas créer ce module' });
            }
        }

        const insert = await pool.query(
            `INSERT INTO module_catalog (nom, niveau, description, logo_url, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (nom, niveau) DO UPDATE
             SET description = COALESCE(EXCLUDED.description, module_catalog.description),
                 logo_url = COALESCE(EXCLUDED.logo_url, module_catalog.logo_url)
             RETURNING *`,
            [moduleName, String(niveau).toUpperCase(), description || null, logo_url || null, userId]
        );

        await pool.query(
            `INSERT INTO moderation_log (moderator_id, contenu_type, contenu_id, action, raison, created_at)
             VALUES ($1, 'MODULE', $2, 'CREATE_MODULE', $3, NOW())`,
            [userId, insert.rows[0].id, `Module ${moduleName} (${String(niveau).toUpperCase()})`]
        );

        res.status(201).json({ message: 'Module créé', module: insert.rows[0] });
    } catch (err) {
        console.error('Erreur createModuleCatalog:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    updateUserRole,
    assignModuleToModerator,
    getModeratorModules,
    getModerationLog,
    getUpcoming,
    createUpcoming,
    search,
    getModulesCatalog,
    createModuleCatalog
};
