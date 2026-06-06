const { HTTP_STATUS } = require('../config/constants');

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!allowedRoles.includes(req.user.role_global)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        yourRole: req.user.role_global
      });
    }

    next();
  };
};

const requireSuperAdmin = requireRole(['SUPER_ADMIN']);
const requireAdmin = requireRole(['ADMIN', 'ADMIN_GLOBAL']);
const requireSchoolAdmin = requireRole(['ADMIN', 'ADMIN_GLOBAL']);
const requireFormateur = requireRole(['ADMIN', 'FORMATEUR', 'FORMATEUR_SIMPLE']);
const requireEtudiant = requireRole(['ADMIN', 'FORMATEUR', 'FORMATEUR_SIMPLE', 'ETUDIANT']);

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireSchoolAdmin,
  requireFormateur,
  requireEtudiant
};
