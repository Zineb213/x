const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Ensure critical secrets are present early to avoid unclear runtime errors
if (!process.env.JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in environment. Set JWT_SECRET in backend/.env or environment variables.');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { initSocket } = require('./sockets');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});


const { testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const adminRoutes = require('./routes/adminRoutes');
const formateurRoutes = require('./routes/formateurRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const postRoutes = require('./routes/postRoutes');
const etudiantRoutes = require('./routes/etudiantRoutes');
const chatRoutes = require('./routes/chatRoutes');
const communityRoutes = require('./routes/communityRoutes');
const satisfactionRoutes = require('./routes/satisfactionRoutes');
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const matchesLocalhost = /^https?:\/\/localhost:\d+$/.test(origin);
    const matchesLoopback = /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin);
    const matchesLan = /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin);
    const matchesEnv = process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL;

    if (matchesLocalhost || matchesLoopback || matchesLan || matchesEnv) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const isProduction = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 50 : 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth requests. Please retry later.' }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 5000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/auth'),
  message: { success: false, error: 'Too many requests' }
});
app.use('/api/auth', authLimiter);
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/formateur', formateurRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/etudiant', etudiantRoutes);  // MUST BE HERE
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/satisfaction', satisfactionRoutes);
// Error handling
app.use(notFound);
app.use(errorHandler);
// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Database connection failed. Server not starting.');
    process.exit(1);
  }
const server = http.createServer(app);
const io = initSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`✅ API ready at /api/auth`);
     console.log(`✅ Socket.io ready for real-time chat`);
  });
};

startServer();
