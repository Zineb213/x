const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const {
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
} = require('../controllers/communityController');

const router = express.Router();

router.use(authenticate);

router.get('/', getAllCommunities);
router.get('/joined', getMyCommunities);
router.get('/suggested', getSuggestedCommunities);
router.get('/modules', getModuleCommunities);
router.get('/by-module/:moduleId', getCommunityIdForModule);
router.get('/:id/can-access', canAccessCommunity);
router.get('/:id', getCommunity);
router.post('/:id/join', joinCommunity);
router.delete('/:id/leave', leaveCommunity);
router.get('/:id/chat', getCommunityChat);
module.exports = router;
