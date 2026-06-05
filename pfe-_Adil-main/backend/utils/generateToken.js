const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Please set JWT_SECRET in environment before starting the server.');
}

const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role_global,
    matricule: user.matricule || null
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = { generateToken, verifyToken };
