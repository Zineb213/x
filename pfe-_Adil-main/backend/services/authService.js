const User = require('../models/User');
const { query } = require('../config/database');
const { generateToken } = require('../utils/generateToken');
const { HTTP_STATUS } = require('../config/constants');

class AuthService {
  async loginWithMatricule(identifier, password) {
    const trimmed = typeof identifier === 'string' ? identifier.trim() : identifier;
    let user = await User.findByMatricule(trimmed);
    if (!user) {
      user = await User.findByEmail(trimmed);
    }

    if (!user) {
      throw { status: HTTP_STATUS.UNAUTHORIZED, message: 'Invalid credentials' };
    }

    if (!user.password_hash) {
      throw { status: HTTP_STATUS.UNAUTHORIZED, message: 'Please use Google login or set a password' };
    }

    const isValid = await User.verifyPassword(user, password);
    if (!isValid) {
      throw { status: HTTP_STATUS.UNAUTHORIZED, message: 'Invalid credentials' };
    }

    if (!user.is_active) {
      throw { status: HTTP_STATUS.FORBIDDEN, message: 'Account disabled. Contact administrator.' };
    }

    if (user.school_id && user.role_global !== 'SUPER_ADMIN') {
      await query(
        `UPDATE schools
         SET payment_status = 'OVERDUE'
         WHERE id = $1
           AND payment_status = 'PENDING'
           AND next_due_date IS NOT NULL
           AND next_due_date < CURRENT_DATE`,
        [user.school_id]
      );

      await query(
        `UPDATE schools
         SET is_active = false,
             suspended_reason = COALESCE(NULLIF(suspended_reason, ''), 'Suspension automatique: depassement de la tolerance de paiement'),
             suspended_at = COALESCE(suspended_at, CURRENT_TIMESTAMP)
         WHERE id = $1
           AND is_active = true
           AND next_due_date IS NOT NULL
           AND payment_status <> 'PAID'
           AND (CURRENT_DATE - next_due_date) > COALESCE(payment_grace_days, 10)`,
        [user.school_id]
      );

      const schoolStatus = await query('SELECT is_active FROM schools WHERE id = $1', [user.school_id]);
      if (schoolStatus.rows.length && schoolStatus.rows[0].is_active === false) {
        throw { status: HTTP_STATUS.FORBIDDEN, message: 'Votre ecole est temporairement suspendue. Contactez la plateforme.' };
      }
    }

    // determine if this is the user's first login (last_login is null)
    const isFirstLogin = !user.last_login;

    await User.updateLastLogin(user.id);
    const token = generateToken(user);

    const { password_hash, ...userWithoutPassword } = user;
    // include is_first_login flag so frontend can show initial setup modal
    return { token, user: { ...userWithoutPassword, is_first_login: isFirstLogin } };
  }
}

module.exports = new AuthService();
