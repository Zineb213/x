// models/Message.js
const { query } = require('../config/database');

class Message {
    static async create(messageData) {
        const { conversation_id, user_id, content, message_type, file_url, file_name, file_size, mime_type, reply_to_message_id } = messageData;
        
        const result = await query(
            `INSERT INTO messages (conversation_id, user_id, content, message_type, file_url, file_name, file_size, mime_type, reply_to_message_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [conversation_id, user_id, content, message_type || 'TEXT', file_url, file_name, file_size, mime_type, reply_to_message_id]
        );
        
        return result.rows[0];
    }

    static async getConversationMessages(conversationId, limit = 50, offset = 0) {
        const result = await query(
            `SELECT m.*, u.nom, u.prenom, u.email
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.conversation_id = $1 AND m.is_deleted = false
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );
        return result.rows.reverse();
    }

    static async updateMessage(messageId, userId, content) {
        const result = await query(
            `UPDATE messages 
             SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3 AND is_deleted = false
             RETURNING *`,
            [content, messageId, userId]
        );
        return result.rows[0];
    }

    static async deleteMessage(messageId, userId, isAdmin = false) {
        let queryText = `UPDATE messages SET is_deleted = true WHERE id = $1 AND user_id = $2`;
        let params = [messageId, userId];
        
        if (isAdmin) {
            queryText = `UPDATE messages SET is_deleted = true WHERE id = $1`;
            params = [messageId];
        }
        
        const result = await query(queryText, params);
        return result.rows[0];
    }

    static async addReaction(messageId, userId, reaction) {
        const result = await query(
            `INSERT INTO message_reactions (message_id, user_id, reaction)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_id, user_id, reaction) DO NOTHING
             RETURNING *`,
            [messageId, userId, reaction]
        );
        return result.rows[0];
    }

    static async removeReaction(messageId, userId, reaction) {
        await query(
            `DELETE FROM message_reactions 
             WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
            [messageId, userId, reaction]
        );
        return true;
    }

    static async getReactions(messageId) {
        const result = await query(
            `SELECT reaction, COUNT(*) as count
             FROM message_reactions
             WHERE message_id = $1
             GROUP BY reaction`,
            [messageId]
        );
        return result.rows;
    }
}

module.exports = Message;
