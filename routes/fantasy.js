// routes/fantasy.js
const express = require("express");
const router = express.Router();
const FantasyTeam = require("../models/FantasyTeam");
const FantasyLeague = require("../models/FantasyLeague");
const Player = require("../models/Player");
const Match = require("../models/match");

// ===============================
// ✅ إنشاء فريق فانتازي جديد
// ===============================
router.post("/team", async (req, res) => {
  try {
    const { userId, name, players } = req.body;

    if (!userId || !name || !players || players.length !== 11) {
      return res.status(400).json({ error: "يجب إدخال بيانات الفريق و 11 لاعب" });
    }

    const team = await FantasyTeam.create({ user: userId, name, players });

    res.json({ message: "✅ تم إنشاء الفريق بنجاح", team });
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء إنشاء الفريق", details: err.message });
  }
});

// ===============================
// ✅ تعديل فريق فانتازي
// ===============================
router.put("/team/:id", async (req, res) => {
  try {
    const { name, players } = req.body;

    const team = await FantasyTeam.findByIdAndUpdate(
      req.params.id,
      { name, players },
      { new: true }
    ).populate("players", "name position team");

    if (!team) return res.status(404).json({ error: "الفريق غير موجود" });

    res.json({ message: "✅ تم تعديل الفريق بنجاح", team });
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء تعديل الفريق", details: err.message });
  }
});

// ===============================
// ✅ جلب فريق مستخدم
// ===============================
router.get("/team/:userId", async (req, res) => {
  try {
    const team = await FantasyTeam.findOne({ user: req.params.userId })
      .populate("players", "name position team");

    if (!team) return res.status(404).json({ error: "لم يتم العثور على فريق" });

    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء جلب الفريق", details: err.message });
  }
});

// ===============================
// ✅ إنشاء دوري فانتازي
// ===============================
router.post("/league", async (req, res) => {
  try {
    const { name, admin } = req.body;

    if (!name || !admin) {
      return res.status(400).json({ error: "الرجاء إدخال اسم الدوري والمدير" });
    }

    const league = await FantasyLeague.create({ name, admin, teams: [] });

    res.json({ message: "✅ تم إنشاء الدوري بنجاح", league });
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء إنشاء الدوري", details: err.message });
  }
});

// ===============================
// ✅ انضمام فريق لدوري
// ===============================
router.post("/league/:leagueId/join", async (req, res) => {
  try {
    const { teamId } = req.body;

    const league = await FantasyLeague.findByIdAndUpdate(
      req.params.leagueId,
      { $addToSet: { teams: teamId } },
      { new: true }
    ).populate("teams");

    if (!league) return res.status(404).json({ error: "الدوري غير موجود" });

    res.json({ message: "✅ تم الانضمام للدوري", league });
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء الانضمام", details: err.message });
  }
});

// ===============================
// ✅ حساب النقاط لفريق
// ===============================
router.get("/team/:id/points", async (req, res) => {
  try {
    const team = await FantasyTeam.findById(req.params.id).populate("players");

    if (!team) return res.status(404).json({ error: "الفريق غير موجود" });

    // 🟢 من هنا تقدر تعدل نظام النقاط (Goals, Assists, Cards...)
    let totalPoints = 0;
    for (const player of team.players) {
      const matches = await Match.find({ "events.player": player.name });

      matches.forEach((match) => {
        match.events.forEach((e) => {
          if (e.player === player.name) {
            if (e.type === "goal") totalPoints += 5;
            if (e.type === "assist") totalPoints += 3;
            if (e.type === "card" && e.cardType === "yellow") totalPoints -= 1;
            if (e.type === "card" && e.cardType === "red") totalPoints -= 3;
          }
        });
      });
    }

    res.json({ teamId: team._id, teamName: team.name, points: totalPoints });
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء حساب النقاط", details: err.message });
  }
});

// ===============================
// ✅ ترتيب الدوري
// ===============================
router.get("/league/:leagueId/ranking", async (req, res) => {
  try {
    const league = await FantasyLeague.findById(req.params.leagueId).populate("teams");

    if (!league) return res.status(404).json({ error: "الدوري غير موجود" });

    let ranking = [];
    for (const team of league.teams) {
      const matches = await Match.find({ "events.player": { $in: team.players.map(p => p.name) } });
      let points = 0;

      matches.forEach((match) => {
        match.events.forEach((e) => {
          if (team.players.includes(e.player)) {
            if (e.type === "goal") points += 5;
            if (e.type === "assist") points += 3;
            if (e.type === "card" && e.cardType === "yellow") points -= 1;
            if (e.type === "card" && e.cardType === "red") points -= 3;
          }
        });
      });

      ranking.push({ teamName: team.name, points });
    }

    ranking.sort((a, b) => b.points - a.points);

    res.json(ranking);
  } catch (err) {
    res.status(500).json({ error: "❌ خطأ أثناء جلب ترتيب الدوري", details: err.message });
  }
});

module.exports = router;