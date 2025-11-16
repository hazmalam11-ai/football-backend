const jwt = require('jsonwebtoken');
const User = require('../user');
const { PERMISSIONS, ROLES } = require('./roles');

// التحقق من JWT
exports.requireAuth = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id).select('_id role name');
    if (!req.user) return res.status(401).json({ message: 'Invalid user' });

    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized', error: e.message });
  }
};

// تحقق من صلاحيات action
exports.authorize = (permission) => {
  return (req, res, next) => {
    // admin دايمًا مسموح
    if (req.user?.role === ROLES.ADMIN) return next();
    const allowed = PERMISSIONS[permission] || [];
    if (allowed.includes(req.user?.role)) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
};

// يتيح التعديل لصاحب المورد أو لأدوار معينة
exports.allowOwnerOr = (getOwnerId, allowedRoles = []) => {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    if (allowedRoles.includes(req.user?.role)) return next();

    const ownerId = await getOwnerId(req);
    if (ownerId && String(ownerId) === String(req.user?._id)) return next();

    return res.status(403).json({ message: 'Forbidden' });
  };
};

