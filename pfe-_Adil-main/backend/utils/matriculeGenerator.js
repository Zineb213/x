// utils/matriculeGenerator.js
const { query } = require('../config/database');

const generateMatricule = async () => {
    const year = new Date().getFullYear();
    let matricule;
    let exists = true;
    
    while (exists) {
        const random = Math.floor(100000 + Math.random() * 900000);
        matricule = `${year}${random}`;
        
        const result = await query('SELECT id FROM users WHERE matricule = $1', [matricule]);
        exists = result.rows.length > 0;
    }
    
    return matricule;
};

module.exports = { generateMatricule };
