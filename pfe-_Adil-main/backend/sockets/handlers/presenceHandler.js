// sockets/handlers/presenceHandler.js
const { query } = require('../../config/database');
const EVENTS = require('../events');

const updateUserPresence = async (userId, isOnline, socketId = null) => {
    await query(
        `INSERT INTO user_presence (user_id, is_online, last_seen, socket_id)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
         ON CONFLICT (user_id) DO UPDATE 
         SET is_online = $2, last_seen = CURRENT_TIMESTAMP, socket_id = $3`,
        [userId, isOnline, socketId]
    );
};

const handleUserOnline = async (io, socket) => {
    try {
        await updateUserPresence(socket.userId, true, socket.id);
        
        // Notify all level rooms that user is online
        if (socket.user.niveau) {
            io.to(`level:${socket.user.niveau}`).emit(EVENTS.USER_ONLINE, {
                userId: socket.userId,
                nom: socket.user.nom,
                prenom: socket.user.prenom,
                niveau: socket.user.niveau
            });
        }
        
        console.log(`User ${socket.user.email} connected`);
        
    } catch (error) {
        console.error('User online error:', error);
    }
};

const handleUserOffline = async (io, socket) => {
    try {
        await updateUserPresence(socket.userId, false, null);
        
        // Notify all level rooms that user is offline
        if (socket.user.niveau) {
            io.to(`level:${socket.user.niveau}`).emit(EVENTS.USER_OFFLINE, {
                userId: socket.userId,
                lastSeen: new Date()
            });
        }
        
        console.log(`User ${socket.user.email} disconnected`);
        
    } catch (error) {
        console.error('User offline error:', error);
    }
};

const getOnlineUsers = async (levelName = null) => {
    let queryText = `
        SELECT u.id, u.email, u.nom, u.prenom, u.niveau, up.last_seen
        FROM user_presence up
        JOIN users u ON up.user_id = u.id
        WHERE up.is_online = true
    `;
    const params = [];
    
    if (levelName) {
        queryText += ` AND u.niveau = $1`;
        params.push(levelName);
    }
    
    const result = await query(queryText, params);
    return result.rows;
};

module.exports = {
    handleUserOnline,
    handleUserOffline,
    getOnlineUsers,
    updateUserPresence
};
