/**
 * Script d'import des ressources S3 dans la base EduConnect
 * Usage : node import_s3.js
 */

const path = require('path');
const fs   = require('fs');
const pool = require('./config/database');

const S3_ROOT = path.join(__dirname, '..', 'S3_extracted', 'S3');
const NIVEAU  = 'L2';

const MODULE_MAP = {
  'AO'  : 'Architecture des Ordinateurs',
  'ASD3': 'Algorithmique et Structures de Données',
  'LM'  : 'Logique Mathématique',
  'MN'  : 'Méthodes Numériques',
  'SI'  : 'Systèmes d\'Information',
  'THG' : 'Théorie des Graphes'
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function isCorrige(name) {
  const n = name.toLowerCase();
  return n.includes('corrig') || n.includes('solution') || n.includes('correction');
}

function extractYear(name) {
  const m = name.match(/(\d{4})/);
  return m ? parseInt(m[1]) : 2024;
}

function extractSerie(folderName) {
  const m = folderName.match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function extractCoursNum(name) {
  // "Cours 3.pdf" → 3, "1-cours1.pdf" → 1
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function pdfToBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

// Retourne tous les PDFs d'un dossier (non récursif)
function pdfsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(dir, f));
}

// Retourne les sous-dossiers
function subDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .map(f => ({ name: f, full: path.join(dir, f) }));
}

// ─── Insert ────────────────────────────────────────────────────────────────

async function insert(params) {
  const {
    titre, description = null, module, resource_type,
    fichier_pdf = null, nombre_chapitres = null,
    numero_serie = null, annee = null,
    session = null, correction_target = null, adminId
  } = params;

  try {
    await pool.query(
      `INSERT INTO ressource_pedagogique
         (titre, description, niveau, module, resource_type, id_auteur, date_ajout,
          fichier_pdf, nombre_chapitres, numero_serie, annee, session, correction_target)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11,$12)`,
      [titre, description, NIVEAU, module, resource_type, adminId,
       fichier_pdf, nombre_chapitres, numero_serie, annee, session, correction_target]
    );
    console.log(`  ✅ [${resource_type}] ${titre}`);
    return true;
  } catch (e) {
    console.error(`  ❌ Erreur pour "${titre}": ${e.message}`);
    return false;
  }
}

// ─── Traitements par section ────────────────────────────────────────────────

async function processCours(sectionPath, moduleName, adminId) {
  // PDFs directs dans COURS/
  for (const f of pdfsIn(sectionPath)) {
    const name = path.basename(f);
    const num  = extractCoursNum(name);
    await insert({
      titre: `Cours ${num} — ${path.basename(name, '.pdf')}`,
      module: moduleName, resource_type: 'COURS',
      fichier_pdf: pdfToBase64(f),
      nombre_chapitres: 1, adminId
    });
  }
  // Sous-dossiers Cours 1/, Cours 2/ …
  for (const { name: sub, full } of subDirs(sectionPath)) {
    const num = extractSerie(sub);
    for (const f of pdfsIn(full)) {
      await insert({
        titre: `Cours ${num} — ${path.basename(f, '.pdf')}`,
        module: moduleName, resource_type: 'COURS',
        fichier_pdf: pdfToBase64(f),
        nombre_chapitres: 1, adminId
      });
    }
  }
}

async function processTD(sectionPath, moduleName, adminId) {
  for (const { name: sub, full } of subDirs(sectionPath)) {
    const serie = extractSerie(sub);
    for (const f of pdfsIn(full)) {
      const name = path.basename(f);
      if (isCorrige(name)) {
        await insert({
          titre: `Corrigé TD ${serie} — ${path.basename(name, '.pdf')}`,
          module: moduleName, resource_type: 'CORRIGE',
          fichier_pdf: pdfToBase64(f),
          correction_target: 'TD', adminId
        });
      } else {
        await insert({
          titre: `TD ${serie} — ${path.basename(name, '.pdf')}`,
          module: moduleName, resource_type: 'TD',
          fichier_pdf: pdfToBase64(f),
          numero_serie: serie, adminId
        });
      }
    }
    // PDFs directement dans le dossier TD (sans sous-dossier)
  }
  // PDFs directs dans TD/
  for (const f of pdfsIn(sectionPath)) {
    const name = path.basename(f);
    const serie = extractSerie(name);
    if (isCorrige(name)) {
      await insert({
        titre: `Corrigé TD ${serie} — ${path.basename(name, '.pdf')}`,
        module: moduleName, resource_type: 'CORRIGE',
        fichier_pdf: pdfToBase64(f),
        correction_target: 'TD', adminId
      });
    } else {
      await insert({
        titre: `TD ${serie} — ${path.basename(name, '.pdf')}`,
        module: moduleName, resource_type: 'TD',
        fichier_pdf: pdfToBase64(f),
        numero_serie: serie, adminId
      });
    }
  }
}

async function processTP(sectionPath, moduleName, adminId) {
  // Sous-dossiers TP1/, TP2/ …
  for (const { name: sub, full } of subDirs(sectionPath)) {
    const serie = extractSerie(sub);
    for (const f of pdfsIn(full)) {
      const name = path.basename(f);
      if (isCorrige(name)) {
        await insert({
          titre: `Corrigé TP ${serie} — ${path.basename(name, '.pdf')}`,
          module: moduleName, resource_type: 'CORRIGE',
          fichier_pdf: pdfToBase64(f),
          correction_target: 'TP', adminId
        });
      } else {
        await insert({
          titre: `TP ${serie} — ${path.basename(name, '.pdf')}`,
          module: moduleName, resource_type: 'TP',
          fichier_pdf: pdfToBase64(f),
          numero_serie: serie, adminId
        });
      }
    }
  }
  // PDFs directs dans TP/
  let tpCounter = 1;
  for (const f of pdfsIn(sectionPath)) {
    const name = path.basename(f);
    // Extraire numéro du préfixe "1-TP1.pdf" → 1
    const prefixMatch = name.match(/^(\d+)-/);
    const serie = prefixMatch ? parseInt(prefixMatch[1]) : tpCounter++;
    if (isCorrige(name)) {
      await insert({
        titre: `Corrigé TP — ${path.basename(name, '.pdf')}`,
        module: moduleName, resource_type: 'CORRIGE',
        fichier_pdf: pdfToBase64(f),
        correction_target: 'TP', adminId
      });
    } else {
      await insert({
        titre: `TP ${serie} — ${path.basename(name, '.pdf')}`,
        module: moduleName, resource_type: 'TP',
        fichier_pdf: pdfToBase64(f),
        numero_serie: serie, adminId
      });
    }
  }
}

async function processExamen(sectionPath, moduleName, adminId, isTest = false) {
  for (const f of pdfsIn(sectionPath)) {
    const name = path.basename(f);
    const annee = extractYear(name);
    const isRattrapage = name.toLowerCase().includes('rattrapage');
    const sessionVal = isRattrapage ? 'Rattrapage' : 'Normale';

    if (isCorrige(name)) {
      await insert({
        titre: `Corrigé Examen ${annee}${isRattrapage ? ' (Rattrapage)' : ''} — ${moduleName}`,
        module: moduleName, resource_type: 'CORRIGE',
        fichier_pdf: pdfToBase64(f),
        correction_target: 'EXAMEN', adminId
      });
    } else {
      await insert({
        titre: isTest
          ? `Test ${annee} — ${moduleName}`
          : `Examen ${annee} ${sessionVal} — ${moduleName}`,
        module: moduleName, resource_type: 'EXAMEN',
        fichier_pdf: pdfToBase64(f),
        annee, session: sessionVal, adminId
      });
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Début de l\'import S3...\n');

  // Récupérer l'ID admin
  const adminRes = await pool.query(
    "SELECT id FROM app_user WHERE role_global = 'ADMIN_GLOBAL' ORDER BY id LIMIT 1"
  );
  if (adminRes.rows.length === 0) {
    console.error('❌ Aucun admin trouvé en base'); process.exit(1);
  }
  const adminId = adminRes.rows[0].id;
  console.log(`👤 Admin ID: ${adminId}\n`);

  for (const [moduleFolder, moduleName] of Object.entries(MODULE_MAP)) {
    const modulePath = path.join(S3_ROOT, moduleFolder);
    if (!fs.existsSync(modulePath)) {
      console.warn(`⚠️  Dossier introuvable: ${modulePath}`);
      continue;
    }
    console.log(`\n📂 Module: ${moduleName} (${moduleFolder})`);

    for (const { name: sec, full: secPath } of subDirs(modulePath)) {
      const secUp = sec.toUpperCase();
      console.log(`  📁 Section: ${sec}`);

      if (secUp.startsWith('COURS')) {
        await processCours(secPath, moduleName, adminId);
      } else if (secUp === 'TD') {
        await processTD(secPath, moduleName, adminId);
      } else if (secUp === 'TP') {
        await processTP(secPath, moduleName, adminId);
      } else if (secUp === 'EXAMEN') {
        await processExamen(secPath, moduleName, adminId, false);
      } else if (secUp === 'TEST' || secUp.startsWith('TEST')) {
        await processExamen(secPath, moduleName, adminId, true);
      } else {
        console.log(`    ⏭️  Section ignorée: ${sec}`);
      }
    }
  }

  console.log('\n✅ Import terminé !');
  await pool.end();
}

main().catch(async e => {
  console.error('💥 Erreur fatale:', e.message);
  await pool.end();
  process.exit(1);
});
