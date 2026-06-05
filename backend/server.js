const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import routes
const authRoutes        = require('./routes/auth');
const resourceRoutes    = require('./routes/resources');
const publicationRoutes = require('./routes/publications');
const chatRoutes        = require('./routes/chat');
const notifRoutes       = require('./routes/notifications');
const adminRoutes       = require('./routes/admin');
const plannerRoutes     = require('./routes/planner');

// Initialiser Express
const app = express();

// Middlewares
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth',          authRoutes);
app.use('/api/resources',     resourceRoutes);
app.use('/api/publications',  publicationRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/planner',       plannerRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: '✅ Serveur en ligne' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Erreur:', err);

    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'Fichier trop volumineux. Réduisez la taille puis réessayez.'
        });
    }

    res.status(500).json({ error: 'Erreur serveur interne' });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur EduConnect lancé sur http://localhost:${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV}`);
});
