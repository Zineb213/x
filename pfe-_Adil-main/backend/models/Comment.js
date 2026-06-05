// models/Comment.js
const { query } = require('../config/database');

class Comment {
    static async create(commentData) {
        const { post_id, user_id, content } = commentData;
        const result = await query(
            `INSERT INTO comments (post_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [post_id, user_id, content]
        );
        return result.rows[0];
    }

    static async findByPostId(postId) {
        const result = await query(
            `SELECT c.*, u.nom, u.prenom, u.email
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id = $1
             ORDER BY c.created_at ASC`,
            [postId]
        );
        return result.rows;
    }

    static async delete(id, userId) {
        const result = await query(
            `DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }

    static async addLike(commentId, userId) {
        const result = await query(
            `INSERT INTO comment_reactions (comment_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (comment_id, user_id) DO NOTHING
             RETURNING *`,
            [commentId, userId]
        );
        
        if (result.rows[0]) {
            await query(`UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1`, [commentId]);
        }
        return result.rows[0];
    }
}

module.exports = Comment;
