const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/user");
const { requireAuth, authorize } = require("../middlewares/auth");

const router = express.Router();

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/avatars");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// 🟢 Register
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password, country = "", fullName = "", role = "user" } = req.body;

    // 1) تحقق من الحقول
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "username, email, and password are required",
      });
    }

    // 2) تحقق من وجود الإيميل
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }

    // 3) تحقق من وجود الـ username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        message: "Username already in use",
      });
    }

    // 4) تشفير الباسورد
    const hashed = await bcrypt.hash(password, 10);

    // 5) إنشاء مستخدم جديد
    const user = await User.create({
      username,
      email,
      password: hashed,
      role,
      country,
      fullName,
    });

    // 6) رجّع المستخدم بدون الباسورد
    const { password: _, ...safeUser } = user.toObject();
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
});

// 🟡 Login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "fallbackSecret",
      { expiresIn: "7d" }
    );

    const { password: _, ...safeUser } = user.toObject();
    res.json({
      success: true,
      message: "Login successful",
      user: safeUser,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// 🔵 Get user info from token
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const dbUser = await User.findById(req.user.id).select("-password");
    if (!dbUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: dbUser });
  } catch (err) {
    next(err);
  }
});

// Upload avatar endpoint
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      message: "Avatar updated successfully", 
      user: updatedUser 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// ===============================
// Admin: update user role
// PATCH /auth/users/:id/role  { role: 'admin'|'moderator'|'editor'|'user' }
router.patch("/users/:id/role", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const allowed = ["admin", "moderator", "editor", "user"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Role updated", user: updated });
  } catch (err) {
    next(err);
  }
});