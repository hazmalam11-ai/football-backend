// routes/leaderboard.js
const express = require("express");
const FantasyTeam = require("../models/FantasyTeam");
const router = express.Router();

// 📌 ترتيب عام
router.get("/", async (req, res) => {
  try {
    const teams = await FantasyTeam.find()
      .populate("user", "username email fullName")
      .sort({ totalPoints: -1 }) // ترتيب تنازلي بالنقاط
      .limit(50); // أعلى 50 فريق

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 ترتيب مستخدم محدد
router.get("/user/:id", async (req, res) => {
  try {
    const teams = await FantasyTeam.find().sort({ totalPoints: -1 });
    const index = teams.findIndex((t) => t.user.toString() === req.params.id);

    if (index === -1) return res.status(404).json({ error: "User not found" });

    res.json({
      rank: index + 1,
      team: teams[index],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;