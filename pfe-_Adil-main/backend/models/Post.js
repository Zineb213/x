// models/Post.js
const { query } = require('../config/database');

class Post {
    static async create(postData) {
        const { user_id, content, image_url, post_type } = postData;
        const result = await query(
            `INSERT INTO posts (user_id, content, image_url, post_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [user_id, content, image_url || null, post_type || 'QUESTION']
        );
        return result.rows[0];
    }

    static async findById(id, viewerUserId = null) {
        const result = await query(
            `SELECT p.*, u.nom, u.prenom, u.email, u.role_global,
                    CASE WHEN pr.user_id IS NOT NULL THEN true ELSE false END as user_reacted
             FROM posts p
             JOIN users u ON p.user_id = u.id
             LEFT JOIN post_reactions pr ON p.id = pr.post_id AND pr.user_id = $2
             WHERE p.id = $1`,
            [id, viewerUserId]
        );
        return result.rows[0];
    }

    static async findAll(filters = {}) {
        let sql = `
            SELECT p.*, u.nom, u.prenom, u.email, u.role_global
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `;
        const params = [];
        
        if (filters.user_id) {
            sql = `SELECT p.*, u.nom, u.prenom, u.email 
                   FROM posts p
                   JOIN users u ON p.user_id = u.id
                   WHERE p.user_id = $1
                   ORDER BY p.created_at DESC`;
            params.push(filters.user_id);
        }
        
        if (filters.post_type) {
            sql = `SELECT p.*, u.nom, u.prenom, u.email 
                   FROM posts p
                   JOIN users u ON p.user_id = u.id
                   WHERE p.post_type = $1
                   ORDER BY p.created_at DESC`;
            params.push(filters.post_type);
        }
        
        const result = await query(sql, params);
        return result.rows;
    }

    static async update(id, updates) {
        const { content, image_url, post_type } = updates;
        const result = await query(
            `UPDATE posts 
             SET content = COALESCE($1, content),
                 image_url = COALESCE($2, image_url),
                 post_type = COALESCE($3, post_type),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [content, image_url, post_type, id]
        );
        return result.rows[0];
    }

    static async delete(id) {
        await query(`DELETE FROM posts WHERE id = $1`, [id]);
        return true;
    }

    static async addReaction(postId, userId, reactionType = 'INSIGHTFUL') {
        const result = await query(
            `INSERT INTO post_reactions (post_id, user_id, reaction_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (post_id, user_id) DO UPDATE 
             SET reaction_type = $3
             RETURNING *`,
            [postId, userId, reactionType]
        );
        return result.rows[0];
    }

    static async removeReaction(postId, userId) {
        await query(
            `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );
        return true;
    }

    static async hasReaction(postId, userId) {
        const result = await query(
            `SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );
        return result.rows.length > 0;
    }

    static async addShare(postId, userId) {
        const result = await query(
            `INSERT INTO shares (post_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, user_id) DO NOTHING
             RETURNING *`,
            [postId, userId]
        );
        return result.rows[0];
    }
}

module.exports = Post;
