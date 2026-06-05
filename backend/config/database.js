const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'educonnect',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '0000',
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
    console.log('✅ Connecté à PostgreSQL');
});

module.exports = pool;
