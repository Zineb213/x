const fs = require('fs');
const path = require('path');
const { query } = require('./config/database');

const MIGRATIONS_DIR = __dirname;
const MIGRATION_PATTERN = /^migration_v\d+.*\.sql$/i;

const getMigrationFiles = () => {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => MIGRATION_PATTERN.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

const runMigrations = async () => {
  const files = getMigrationFiles();
  if (!files.length) {
    console.log('ℹ️ No migration files found.');
    return;
  }

  console.log(`ℹ️ Executing ${files.length} SQL migration file(s)`);
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8').trim();
    if (!sql) continue;

    console.log(`➡️ Applying migration: ${file}`);
    try {
      await query(sql);
      console.log(`✅ Applied migration: ${file}`);
    } catch (error) {
      console.error(`❌ Failed to apply migration ${file}:`, error.message || error);
      throw error;
    }
  }
};

module.exports = { runMigrations };
