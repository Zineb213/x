const pool = require('./config/database');
require('dotenv').config();

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_planner_config (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        block_size_hours INT NOT NULL DEFAULT 1,
        start_minutes INT NOT NULL DEFAULT 480,
        end_minutes INT NOT NULL DEFAULT 1200,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_planner_config_user UNIQUE(user_id),
        CONSTRAINT ck_planner_block_size CHECK (block_size_hours IN (1,2,3)),
        CONSTRAINT ck_planner_hours CHECK (end_minutes > start_minutes)
      );
    `);
    console.log('Table weekly_planner_config : OK');

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_planner_entry (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        day_index INT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
        slot_key VARCHAR(20) NOT NULL,
        title TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_planner_entry UNIQUE(user_id, day_index, slot_key)
      );
    `);
    console.log('Table weekly_planner_entry : OK');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_planner_entry_user ON weekly_planner_entry(user_id);
    `);
    console.log('Index idx_planner_entry_user : OK');

    console.log('\nMigration planner terminee avec succes.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => {
  console.error('Erreur migration :', e.message);
  process.exit(1);
});
