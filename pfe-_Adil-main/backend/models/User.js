const { query } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
  static async findById(id) {
    const result = await query(
      `SELECT id, matricule, email, nom, prenom, role_global, niveau,
              google_id, is_active, last_login, created_at, school_id
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query(
      `SELECT id, matricule, email, password_hash, nom, prenom, role_global,
              niveau, google_id, is_active, last_login, school_id
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0];
  }

  static async findByMatricule(matricule) {
    const result = await query(
      `SELECT id, matricule, email, password_hash, nom, prenom, role_global,
              niveau, google_id, is_active, last_login, school_id
       FROM users WHERE matricule = $1`,
      [matricule]
    );
    return result.rows[0];
  }

  static async findByGoogleId(googleId) {
    const result = await query(
      `SELECT id, matricule, email, password_hash, nom, prenom, role_global,
              niveau, google_id, is_active, last_login, school_id
       FROM users WHERE google_id = $1`,
      [googleId]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await query(
      `SELECT id, matricule, email, nom, prenom, role_global, niveau, is_active, created_at, school_id
       FROM users
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  static async findAllBySchool(schoolId) {
    const result = await query(
      `SELECT id, matricule, email, nom, prenom, role_global, niveau, is_active, created_at, school_id
       FROM users
       WHERE school_id = $1
       ORDER BY created_at DESC`,
      [schoolId]
    );
    return result.rows;
  }

  static async create(userData) {
    const { matricule, email, password_hash, nom, prenom, role_global, niveau, school_id = null } = userData;
    const result = await query(
      `INSERT INTO users (matricule, email, password_hash, nom, prenom, role_global, niveau, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, matricule, email, nom, prenom, role_global, niveau, school_id`,
      [matricule, email.toLowerCase(), password_hash, nom, prenom, role_global, niveau, school_id]
    );
    return result.rows[0];
  }

  static async createFromGoogle(email, nom, prenom, googleId) {
    const result = await query(
      `INSERT INTO users (email, nom, prenom, google_id, role_global)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nom, prenom, role_global, is_active`,
      [email.toLowerCase(), nom, prenom, googleId, 'ETUDIANT']
    );
    return result.rows[0];
  }

  static async updateLastLogin(userId) {
    await query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [userId]);
  }

  static async updatePassword(userId, hashedPassword) {
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, userId]);
  }

  static async verifyPassword(user, password) {
    if (!user.password_hash) return false;
    return await bcrypt.compare(password, user.password_hash);
  }

  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }
}

module.exports = User;
