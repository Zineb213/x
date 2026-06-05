// models/Conversation.js
const { query } = require('../config/database');
const { findModuleRowForCommunitySlug } = require('../utils/moduleCommunitySlug');

class Conversation {
    static async isParticipant(conversationId, userId) {
        const result = await query(
            `SELECT 1
             FROM conversation_participants
             WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [conversationId, userId]
        );
        return result.rows.length > 0;
    }

    static async getParticipantRole(conversationId, userId) {
        const result = await query(
            `SELECT role
             FROM conversation_participants
             WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [conversationId, userId]
        );
        return result.rows[0]?.role || null;
    }

    static async createPrivate(userId1, userId2) {
        if (!userId1 || !userId2 || Number(userId1) === Number(userId2)) {
            throw new Error('Invalid private conversation participants');
        }

        // Check if private conversation already exists
        const existing = await query(
            `SELECT c.* FROM conversations c
             JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
             JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
             WHERE c.conversation_type = 'PRIVATE'
             AND cp1.user_id = $1 AND cp2.user_id = $2`,
            [userId1, userId2]
        );
        
        if (existing.rows.length > 0) {
            return existing.rows[0];
        }
        
        // Create new private conversation
        const result = await query(
            `INSERT INTO conversations (conversation_type, created_by)
             VALUES ($1, $2)
             RETURNING *`,
            ['PRIVATE', userId1]
        );
        
        const conversation = result.rows[0];
        
        // Add participants
        await query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role)
             VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')`,
            [conversation.id, userId1, userId2]
        );
        
        return conversation;
    }

    static async createGroup(groupName, createdBy, participantIds = []) {
        const result = await query(
            `INSERT INTO conversations (conversation_type, group_name, created_by)
             VALUES ($1, $2, $3)
             RETURNING *`,
            ['GROUP', groupName, createdBy]
        );
        
        const conversation = result.rows[0];
        
        // Add creator as OWNER
        await query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role)
             VALUES ($1, $2, 'OWNER')`,
            [conversation.id, createdBy]
        );
        
        // Add other participants
        for (const userId of participantIds) {
            if (userId !== createdBy) {
                await query(
                    `INSERT INTO conversation_participants (conversation_id, user_id, role)
                     VALUES ($1, $2, 'MEMBER')`,
                    [conversation.id, userId]
                );
            }
        }
        
        return conversation;
    }

    static async getOrCreateLevelChat(levelName) {
        // First try to find existing level chat
        let result = await query(
            `SELECT * FROM conversations 
             WHERE conversation_type = 'LEVEL' AND level_name = $1`,
            [levelName]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        // Create new level chat
        const groupName = `${levelName} Community Chat`;
        result = await query(
            `INSERT INTO conversations (conversation_type, group_name, level_name, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            ['LEVEL', groupName, levelName, null]
        );
        
        return result.rows[0];
    }

    static async getUserConversations(userId) {
        const result = await query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id 
                     AND created_at > COALESCE(
                        (SELECT last_read_at FROM conversation_participants 
                         WHERE conversation_id = c.id AND user_id = $1), 
                        '1970-01-01'
                     )) as unread_count
             FROM conversations c
             JOIN conversation_participants cp ON c.id = cp.conversation_id
             WHERE cp.user_id = $1 AND cp.left_at IS NULL
             ORDER BY c.updated_at DESC`,
            [userId]
        );
        return result.rows;
    }

    static async addParticipant(conversationId, userId, role = 'MEMBER') {
        const result = await query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (conversation_id, user_id) DO UPDATE 
             SET left_at = NULL, role = $3
             RETURNING *`,
            [conversationId, userId, role]
        );
        return result.rows[0];
    }

    static async removeParticipant(conversationId, userId) {
        await query(
            `UPDATE conversation_participants 
             SET left_at = CURRENT_TIMESTAMP 
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        return true;
    }

    static async getParticipants(conversationId) {
        const result = await query(
            `SELECT u.id, u.email, u.nom, u.prenom, u.role_global, u.niveau,
                    cp.role as participant_role, cp.joined_at, cp.last_read_at
             FROM conversation_participants cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.conversation_id = $1 AND cp.left_at IS NULL`,
            [conversationId]
        );
        return result.rows;
    }

    static async updateLastRead(conversationId, userId) {
        await query(
            `UPDATE conversation_participants 
             SET last_read_at = CURRENT_TIMESTAMP 
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
    }

    // =============================================
    // NEW METHOD FOR STUDENT-FORMATEUR CHAT (LAB 1)
    // =============================================
    static async findPrivateConversation(userId1, userId2) {
        const result = await query(
            `SELECT c.* FROM conversations c
             JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
             JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
             WHERE c.conversation_type = 'PRIVATE'
             AND cp1.user_id = $1 AND cp2.user_id = $2
             AND cp1.left_at IS NULL AND cp2.left_at IS NULL`,
            [userId1, userId2]
        );
        return result.rows[0];
    }

    static async userCanAccessModuleCommunity(userId, communityId, roleGlobal) {
        const member = await query(
            `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`,
            [communityId, userId]
        );
        if (member.rows.length > 0) return true;

        const slugRes = await query(`SELECT slug FROM communities WHERE id = $1`, [communityId]);
        const slug = slugRes.rows[0]?.slug;
        if (!slug) return false;

        const modList = await query(`SELECT id, code FROM modules`);
        const mod = findModuleRowForCommunitySlug(slug, modList.rows);
        if (!mod) return false;

        if (roleGlobal === 'FORMATEUR' || roleGlobal === 'FORMATEUR_SIMPLE') {
            const a = await query(
                `SELECT 1 FROM formateur_module_assignment WHERE formateur_id = $1 AND module_id = $2`,
                [userId, mod.id]
            );
            return a.rows.length > 0;
        }
        if (roleGlobal === 'ETUDIANT') {
            const e = await query(
                `SELECT 1 FROM etudiant_module_enrollment WHERE etudiant_id = $1 AND module_id = $2 AND status = 'ACTIVE'`,
                [userId, mod.id]
            );
            return e.rows.length > 0;
        }
        return false;
    }

    static async canJoinCommunityConversation(userId, conversationId, roleGlobal) {
        const conv = await query(
            `SELECT community_id, is_community_chat FROM conversations WHERE id = $1`,
            [conversationId]
        );
        const row = conv.rows[0];
        if (!row || !row.is_community_chat || !row.community_id) return false;
        return this.userCanAccessModuleCommunity(userId, row.community_id, roleGlobal);
    }
}

module.exports = Conversation;
