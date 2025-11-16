
// routes/players.js
const express = require("express");
const Player = require("../models/Player");
const { requireAuth, authorize } = require("../middlewares/auth");
const { getPlayerInfo, getPlayerStats, getTopScorers } = require("../services/footballAPI");

const router = express.Router();

/* ========================
    API-Football Endpoints
   ======================== */

// 📌 جلب هدافي اللاعبين من API
router.get("/api/topscorers", async (req, res, next) => {
  try {
    const { league, season } = req.query;
    const currentSeason = season || new Date().getFullYear();
    
    if (!league) {
      return res.status(400).json({ message: "League ID is required" });
    }
    
    console.log(`🏆 Fetching top scorers for league ${league}, season ${currentSeason}`);
    const topScorers = await getTopScorers(league, currentSeason);
    
    // Set proper UTF-8 encoding
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(topScorers);
  } catch (err) {
    next(err);
  }
});

// 📌 جلب بيانات لاعب من API
router.get("/api/:id", async (req, res, next) => {
  try {
    const player = await getPlayerInfo(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Player not found in API" });
    }
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// 📌 جلب إحصائيات لاعب من API
router.get("/api/:id/stats", async (req, res, next) => {
  try {
    const season = new Date().getFullYear(); // الموسم الحالي
    const stats = await getPlayerStats(req.params.id, season);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/* ========================
    MongoDB Endpoints
   ======================== */

// ➕ إنشاء لاعب (admin/editor)
router.post("/", requireAuth, authorize("team:create"), async (req, res, next) => {
  try {
    const { name, position, team } = req.body;
    if (!name || !position || !team) {
      res.status(400);
      throw new Error("name, position, team are required");
    }
    const player = await Player.create(req.body);
    const populated = await Player.findById(player._id).populate("team", "name country");
    res.status(201).json({ message: "Player created", player: populated });
  } catch (err) {
    next(err);
  }
});

// 📌 كل اللاعبين (من DB)
router.get("/", async (req, res, next) => {
  try {
    const players = await Player.find().populate("team", "name country");
    res.json(players);
  } catch (err) {
    next(err);
  }
});

// 📌 لاعب واحد (من DB)
router.get("/:id", async (req, res, next) => {
  try {
    const player = await Player.findById(req.params.id).populate("team", "name country");
    if (!player) {
      res.status(404);
      throw new Error("Player not found");
    }
    res.json(player);
  } catch (err) {
    next(err);
  }
});

// ✏️ تحديث لاعب (من DB)
router.put("/:id", requireAuth, authorize("team:update"), async (req, res, next) => {
  try {
    const updated = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("team", "name country");
    if (!updated) {
      res.status(404);
      throw new Error("Player not found");
    }
    res.json({ message: "Player updated", player: updated });
  } catch (err) {
    next(err);
  }
});

// 🗑️ حذف لاعب (من DB)
router.delete("/:id", requireAuth, authorize("team:delete"), async (req, res, next) => {
  try {
    const deleted = await Player.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404);
      throw new Error("Player not found");
    }
    res.json({ message: "Player deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



