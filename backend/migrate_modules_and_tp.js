const pool = require('./config/database');
require('dotenv').config();

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'resource_type_enum' AND e.enumlabel = 'TP'
        ) THEN
          ALTER TYPE resource_type_enum ADD VALUE 'TP';
        END IF;
      END
      $$;
    `);
    console.log('Enum resource_type_enum: TP OK');

    await client.query(`
      CREATE TABLE IF NOT EXISTS module_catalog (
        id BIGSERIAL PRIMARY KEY,
        nom VARCHAR(120) NOT NULL,
        niveau niveau_enum NOT NULL,
        description TEXT,
        logo_url TEXT,
        created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_module_catalog UNIQUE (nom, niveau)
      );
    `);
    console.log('Table module_catalog: OK');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_module_catalog_niveau_nom
      ON module_catalog(niveau, nom);
    `);
    console.log('Index idx_module_catalog_niveau_nom: OK');

    console.log('Migration modules/TP terminee avec succes.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error('Erreur migration modules/TP:', e.message);
  process.exit(1);
});
