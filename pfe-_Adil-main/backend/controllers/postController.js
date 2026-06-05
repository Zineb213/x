// controllers/postController.js
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { HTTP_STATUS } = require('../config/constants');

// =============================================
// POST CRUD OPERATIONS
// =============================================

const createPost = async (req, res, next) => {
    try {
        const { content, image_url, post_type } = req.body;
        
        if (!content) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Content is required'
            });
        }
        
        const post = await Post.create({
            user_id: req.user.id,
            content,
            image_url,
            post_type: post_type || 'QUESTION'
        });
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: post,
            message: 'Post created successfully'
        });
    } catch (error) {
        next(error);
    }
};

const getAllPosts = async (req, res, next) => {
    try {
        const { user_id, post_type } = req.query;
        const filters = {};
        
        if (user_id) filters.user_id = parseInt(user_id);
        if (post_type) filters.post_type = post_type;
        
        const posts = await Post.findAll(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: posts,
            count: posts.length
        });
    } catch (error) {
        next(error);
    }
};

const getPostById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await Post.findById(id, req.user.id);
        
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        // Get comments for this post
        const comments = await Comment.findByPostId(id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: { ...post, comments }
        });
    } catch (error) {
        next(error);
    }
};

const updatePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content, image_url, post_type } = req.body;
        
        const post = await Post.findById(id, req.user.id);
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        // Only author can update
        if (post.user_id !== req.user.id && req.user.role_global !== 'ADMIN') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You can only update your own posts'
            });
        }
        
        const updatedPost = await Post.update(id, { content, image_url, post_type });
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: updatedPost,
            message: 'Post updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

const deletePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const post = await Post.findById(id, req.user.id);
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        // Only author or admin can delete
        if (post.user_id !== req.user.id && req.user.role_global !== 'ADMIN') {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: 'You can only delete your own posts'
            });
        }
        
        await Post.delete(id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// REACTION (INSIGHTFUL) OPERATIONS
// =============================================

const addReaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reaction_type } = req.body;
        
        const post = await Post.findById(id, req.user.id);
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        const reaction = await Post.addReaction(id, req.user.id, reaction_type || 'INSIGHTFUL');
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: reaction,
            message: 'Reaction added successfully'
        });
    } catch (error) {
        next(error);
    }
};

const removeReaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const hasReaction = await Post.hasReaction(id, req.user.id);
        if (!hasReaction) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'You have not reacted to this post'
            });
        }
        
        await Post.removeReaction(id, req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Reaction removed successfully'
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// COMMENT OPERATIONS
// =============================================

const addComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        if (!content) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: 'Comment content is required'
            });
        }
        
        const post = await Post.findById(id, req.user.id);
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        const comment = await Comment.create({
            post_id: id,
            user_id: req.user.id,
            content
        });
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: comment,
            message: 'Comment added successfully'
        });
    } catch (error) {
        next(error);
    }
};

const deleteComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        
        const comment = await Comment.delete(commentId, req.user.id);
        
        if (!comment) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Comment not found or you are not the author'
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// =============================================
// SHARE OPERATIONS
// =============================================

const sharePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const post = await Post.findById(id);
        if (!post) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: 'Post not found'
            });
        }
        
        const share = await Post.addShare(id, req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: share,
            message: 'Post shared successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPost,
    getAllPosts,
    getPostById,
    updatePost,
    deletePost,
    addReaction,
    removeReaction,
    addComment,
    deleteComment,
    sharePost
};
