// seedAdmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // ✅ لازم نضيف دي
const User = require("./models/user"); // خلي بالك اسم الملف لازم يكون مظبوط
const dotenv = require("dotenv");

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const adminExists = await User.findOne({ role: "admin" });
    if (adminExists) {
      console.log("✅ Admin user already exists");
      process.exit();
    }

    // ✅ تشفير الباسورد
    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = new User({
      username: "hazem11",
      email: "hazem11@example.com",
      password: hashedPassword, // ✅ متخزن متشفر
      role: "admin",
      permissions: ["team:create", "team:update", "team:delete"],
    });

    await admin.save();
    console.log("✅ Admin user created successfully:", admin);
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding admin:", err.message);
    process.exit(1);
  }
};

seedAdmin();