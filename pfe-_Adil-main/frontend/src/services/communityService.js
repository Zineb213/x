import api from './api';

const communityService = {
    // Get all communities
    getAllCommunities: async () => {
        const response = await api.get('/communities');
        return response.data;
    },
    
    // Get communities student has joined
    getMyCommunities: async () => {
        const response = await api.get('/communities/joined');
        return response.data;
    },
    
    // Get suggested communities
    getSuggestedCommunities: async () => {
        const response = await api.get('/communities/suggested');
        return response.data;
    },
    
    // Get single community
    getCommunity: async (communityId) => {
        const response = await api.get(`/communities/${communityId}`);
        return response.data;
    },
    
    // Join a community
    joinCommunity: async (communityId) => {
        const response = await api.post(`/communities/${communityId}/join`);
        return response.data;
    },
    
    // Leave a community
    leaveCommunity: async (communityId) => {
        const response = await api.delete(`/communities/${communityId}/leave`);
        return response.data;
    },
    
    // Get community chat
    getCommunityChat: async (communityId) => {
        const response = await api.get(`/communities/${communityId}/chat`);
        return response.data;
    }
};

export default communityService;
