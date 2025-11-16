const jwt = require("jsonwebtoken");

// 🟢 التحقق من التوكن (JWT)
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallbackSecret");

    // بيرجع { id, email, role } من التوكن
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// 🟡 التحقق من الصلاحيات (Roles)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: You don't have permission",
      });
    }

    next();
  };
};

// 🔵 السماح للـ admin أو صاحب البيانات (الـ owner)
const allowOwnerOr = (getOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // ✅ admin يدخل دايمًا
      if (req.user.role === "admin") {
        return next();
      }

      // نجيب صاحب الريسورس (مثلاً comment.author)
      const ownerId = await getOwnerId(req);

      if (!ownerId || req.user.id.toString() !== ownerId.toString()) {
        return res.status(403).json({ message: "Forbidden: Not owner" });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

// 🔵 السماح للـ owner أو أدوار محددة (مثل admin/moderator/editor)
const allowOwnerOrRoles = (getOwnerId, roles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // ✅ إذا عنده أحد الأدوار المسموحة يدخل
      if (roles.includes(req.user.role)) {
        return next();
      }

      // ✅ وإلا لازم يكون صاحب الريسورس
      const ownerId = await getOwnerId(req);
      if (!ownerId || req.user.id.toString() !== ownerId.toString()) {
        return res.status(403).json({ message: "Forbidden: Not owner" });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { requireAuth, authorize, allowOwnerOr, allowOwnerOrRoles };
