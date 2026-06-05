// controllers/communityController.js
const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');
const Module = require('../models/Module');
const Conversation = require('../models/Conversation');
const { findModuleRowForCommunitySlug, slugFromModuleCode } = require('../utils/moduleCommunitySlug');

async function syncFormateursToModuleCommunityChat(communityId, conversationId) {
    const slugRes = await query(`SELECT slug FROM communities WHERE id = $1`, [communityId]);
    const slug = slugRes.rows[0]?.slug;
    if (!slug) return;
    const modList = await query(`SELECT id, code FROM modules`);
    const mod = findModuleRowForCommunitySlug(slug, modList.rows);
    if (!mod) return;
    const formateurs = await Module.getFormateursByModule(mod.id);
    for (const f of formateurs) {
        await Conversation.addParticipant(conversationId, f.id, 'MEMBER');
    }
}

// Get all communities
const getAllCommunities = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT c.*, 
                   cat.name as category_name,
                   cat.color as category_color,
                   COALESCE(cm.member_count, 0) as member_count,
                   CASE WHEN cm2.user_id IS NOT NULL THEN true ELSE false END as is_member
            FROM communities c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN (
                SELECT community_id, COUNT(*) as member_count 
                FROM community_members 
                GROUP BY community_id
            ) cm ON c.id = cm.community_id
            LEFT JOIN community_members cm2 ON c.id = cm2.community_id AND cm2.user_id = $1
            ORDER BY c.name
        `, [req.user.id]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get communities user has joined
const getMyCommunities = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT c.*, cat.name as category_name, cat.color as category_color
            FROM community_members cm
            JOIN communities c ON cm.community_id = c.id
            LEFT JOIN categories cat ON c.category_id = cat.id
            WHERE cm.user_id = $1
            ORDER BY cm.joined_at DESC
        `, [req.user.id]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get suggested communities
const getSuggestedCommunities = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT c.*, cat.name as category_name, cat.color as category_color,
                   COALESCE(cm.member_count, 0) as member_count
            FROM communities c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN (
                SELECT community_id, COUNT(*) as member_count 
                FROM community_members 
                GROUP BY community_id
            ) cm ON c.id = cm.community_id
            WHERE NOT EXISTS (
                SELECT 1 FROM community_members 
                WHERE community_id = c.id AND user_id = $1
            )
            ORDER BY member_count DESC
            LIMIT 10
        `, [req.user.id]);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get single community
const getCommunity = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await query(`
            SELECT c.*, cat.name as category_name, cat.color as category_color,
                   COALESCE(cm.member_count, 0) as member_count,
                   CASE WHEN cm2.user_id IS NOT NULL THEN true ELSE false END as is_member
            FROM communities c
            LEFT JOIN categories cat ON c.category_id = cat.id
            LEFT JOIN (
                SELECT community_id, COUNT(*) as member_count 
                FROM community_members 
                GROUP BY community_id
            ) cm ON c.id = cm.community_id
            LEFT JOIN community_members cm2 ON c.id = cm2.community_id AND cm2.user_id = $2
            WHERE c.id = $1
        `, [id, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Community not found'
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// Join community
const joinCommunity = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if already member
        const existing = await query(
            `SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        
        if (existing.rows.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Already a member'
            });
        }
        
        await query(
            `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)`,
            [id, req.user.id]
        );
        
        await query(
            `UPDATE communities SET member_count = member_count + 1 WHERE id = $1`,
            [id]
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Joined community successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Leave community
// Leave community
const leaveCommunity = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Get the conversation for this community
        const conversation = await query(
            `SELECT id FROM conversations WHERE community_id = $1 AND is_community_chat = true`,
            [id]
        );
        
        // Remove member from database
        await query(
            `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        
        // Update member count
        await query(
            `UPDATE communities SET member_count = member_count - 1 WHERE id = $1`,
            [id]
        );
        
        // If there's a conversation, user will automatically leave the socket room on disconnect
        // The frontend will handle leaving the room
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Left community successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Get community chat
const getCommunityChat = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Get or create conversation for this community
        let conversation = await query(
            `SELECT * FROM conversations WHERE community_id = $1 AND is_community_chat = true`,
            [id]
        );
        
        if (conversation.rows.length === 0) {
            const community = await query(`SELECT name FROM communities WHERE id = $1`, [id]);
            const communityName = community.rows[0]?.name || 'Community Chat';
            
            const result = await query(
                `INSERT INTO conversations (conversation_type, group_name, community_id, is_community_chat, created_by)
                 VALUES ('COMMUNITY', $1, $2, true, $3)
                 RETURNING *`,
                [communityName, id, req.user.id]
            );
            conversation = result;
        }
        
        // Add user as participant
        await query(
            `INSERT INTO conversation_participants (conversation_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [conversation.rows[0].id, req.user.id]
        );

        await syncFormateursToModuleCommunityChat(id, conversation.rows[0].id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: conversation.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

const canAccessCommunity = async (req, res, next) => {
    try {
        const communityId = parseInt(req.params.id, 10);
        const member = await query(
            `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`,
            [communityId, req.user.id]
        );
        if (member.rows.length > 0) {
            return res.status(HTTP_STATUS.OK).json({ success: true, data: { allowed: true } });
        }
        const allowed = await Conversation.userCanAccessModuleCommunity(
            req.user.id,
            communityId,
            req.user.role_global
        );
        return res.status(HTTP_STATUS.OK).json({ success: true, data: { allowed } });
    } catch (error) {
        next(error);
    }
};

const getCommunityIdForModule = async (req, res, next) => {
    try {
        const moduleId = parseInt(req.params.moduleId, 10);
        if (['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(req.user.role_global)) {
            const a = await query(
                `SELECT 1 FROM formateur_module_assignment WHERE formateur_id = $1 AND module_id = $2`,
                [req.user.id, moduleId]
            );
            if (a.rows.length === 0) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    success: false,
                    error: 'Vous n’êtes pas assigné à ce module'
                });
            }
        } else if (req.user.role_global !== 'ADMIN') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, error: 'Forbidden' });
        }
        const mod = await query(`SELECT code FROM modules WHERE id = $1`, [moduleId]);
        if (mod.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: 'Module not found' });
        }
        const slug = slugFromModuleCode(mod.rows[0].code);
        const c = await query(`SELECT id FROM communities WHERE slug = $1`, [slug]);
        if (c.rows.length === 0) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Aucune communauté pour ce module (assignez un formateur au module pour la créer)'
            });
        }
        res.status(HTTP_STATUS.OK).json({ success: true, data: { id: c.rows[0].id } });
    } catch (error) {
        next(error);
    }
};
// Get communities for modules the student is enrolled in
const getModuleCommunities = async (req, res, next) => {
    try {
        // Get modules the student is enrolled in
        const enrolledModules = await query(`
            SELECT m.id, m.code, m.nom
            FROM etudiant_module_enrollment e
            JOIN modules m ON e.module_id = m.id
            WHERE e.etudiant_id = $1 AND e.status = 'ACTIVE'
        `, [req.user.id]);
        
        // Get communities for these modules
        const communities = [];
        
        for (const module of enrolledModules.rows) {
            const communitySlug = slugFromModuleCode(module.code);
            const community = await query(`
                SELECT c.*, 
                       CASE WHEN cm.user_id IS NOT NULL THEN true ELSE false END as is_member
                FROM communities c
                LEFT JOIN community_members cm ON c.id = cm.community_id AND cm.user_id = $1
                WHERE c.slug = $2
            `, [req.user.id, communitySlug]);
            
            if (community.rows.length > 0) {
                communities.push({
                    ...community.rows[0],
                    module_code: module.code,
                    module_nom: module.nom
                });
            }
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: communities
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllCommunities,
    getMyCommunities,
    getSuggestedCommunities,
    getCommunity,
    joinCommunity,
    leaveCommunity,
    getCommunityChat,
    canAccessCommunity,
    getCommunityIdForModule,
    getModuleCommunities
};
