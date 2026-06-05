const { verifyToken } = require('../utils/generateToken');
const User = require('../models/User');
const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded, error } = verifyToken(token);

    if (!valid) {
      const message = error === 'jwt expired' ? 'Token expired' : 'Invalid token';
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: message });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'User not found or inactive'
      });
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

      const schoolResult = await query('SELECT is_active FROM schools WHERE id = $1', [user.school_id]);
      if (schoolResult.rows.length && schoolResult.rows[0].is_active === false) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: 'Votre ecole est suspendue. Acces bloque temporairement.'
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

module.exports = authenticate;
