const pool = require('./config/database');
require('dotenv').config();

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE ressource_pedagogique
      ADD COLUMN IF NOT EXISTS logo_url TEXT;
    `);
    console.log('Colonne logo_url: OK');

    console.log('Migration ressources media terminee avec succes.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error('Erreur migration ressources media:', e.message);
  process.exit(1);
});
