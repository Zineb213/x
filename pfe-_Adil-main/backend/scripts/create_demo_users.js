const User = require('../models/User');
const { generateMatricule } = require('../utils/matriculeGenerator');
const { ROLES, NIVEAU } = require('../config/constants');

const PASSWORD = process.env.DEMO_PASSWORD || 'yacine77';

const demoUsers = [
  { role: ROLES.SUPER_ADMIN, email: 'demo.superadmin@eduplatform.com', nom: 'Super', prenom: 'Admin', niveau: null, school_id: null },
  { role: ROLES.ADMIN, email: 'demo.admin@eduplatform.com', nom: 'Admin', prenom: 'Ecole', niveau: null, school_id: null },
  { role: ROLES.FORMATEUR, email: 'demo.formateur.global@eduplatform.com', nom: 'Formateur', prenom: 'Global', niveau: null, school_id: null },
  { role: ROLES.FORMATEUR_SIMPLE, email: 'demo.formateur.simple@eduplatform.com', nom: 'Formateur', prenom: 'Simple', niveau: null, school_id: null },
  { role: ROLES.ETUDIANT, email: 'demo.etudiant.simple@eduplatform.com', nom: 'Etudiant', prenom: 'Simple', niveau: NIVEAU.L1, school_id: null }
];

(async () => {
  try {
    for (const u of demoUsers) {
      const existing = await User.findByEmail(u.email);
      if (existing) {
        console.log(`Exists: ${u.email} -> id=${existing.id}, role=${existing.role_global}`);
        continue;
      }

      const matricule = await generateMatricule();
      const hashed = await User.hashPassword(PASSWORD);

      const created = await User.create({
        matricule,
        email: u.email,
        password_hash: hashed,
        nom: u.nom,
        prenom: u.prenom,
        role_global: u.role,
        niveau: u.niveau,
        school_id: u.school_id
      });

      console.log(`Created: ${u.email} -> id=${created.id}, matricule=${created.matricule}, role=${created.role_global}`);
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error creating demo users:', err);
    process.exit(1);
  }
})();
