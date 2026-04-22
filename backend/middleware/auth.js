const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      walletAddress: user.walletAddress || null,
      email: user.email,
      role: user.role || 'FARMER',
    },
    process.env.JWT_SECRET || 'your_jwt_secret_key_change_this',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = { authenticateToken, generateToken };
