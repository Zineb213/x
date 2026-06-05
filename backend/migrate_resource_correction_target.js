const pool = require('./config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE ressource_pedagogique
      ADD COLUMN IF NOT EXISTS correction_target VARCHAR(20);
    `);
    console.log('Colonne correction_target : OK');

    await client.query(`
      ALTER TABLE ressource_pedagogique
      DROP CONSTRAINT IF EXISTS ck_resource_correction_target;
    `);

    await client.query(`
      ALTER TABLE ressource_pedagogique
      ADD CONSTRAINT ck_resource_correction_target
      CHECK (correction_target IS NULL OR correction_target IN ('TD', 'TP', 'EXAMEN'));
    `);
    console.log('Contrainte correction_target : OK');

    console.log('Migration correction_target terminee avec succes.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error('Erreur migration correction_target:', e.message);
  process.exit(1);
});
