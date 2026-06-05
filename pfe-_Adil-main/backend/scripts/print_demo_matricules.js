const { query } = require('../config/database');

(async () => {
  try {
    const emails = [
      'demo.superadmin@eduplatform.com',
      'demo.admin@eduplatform.com',
      'demo.formateur.global@eduplatform.com',
      'demo.formateur.simple@eduplatform.com',
      'demo.etudiant.simple@eduplatform.com'
    ];

    const res = await query(
      `SELECT id, email, matricule, role_global FROM users WHERE email = ANY($1) ORDER BY email`,
      [emails]
    );

    res.rows.forEach(r => console.log(`${r.email} | id=${r.id} | role=${r.role_global} | matricule=${r.matricule}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
