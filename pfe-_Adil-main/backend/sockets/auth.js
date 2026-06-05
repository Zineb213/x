// sockets/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.is_active) {
            return next(new Error('User not found or inactive'));
        }
        
        socket.user = user;
        socket.userId = user.id;
        next();
    } catch (error) {
        console.error('Socket auth error:', error.message);
        next(new Error('Invalid token'));
    }
};

module.exports = authenticateSocket;
