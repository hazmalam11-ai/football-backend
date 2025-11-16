const express = require("express");
const Tournament = require("../models/tournament");
const Team = require("../models/Team");
const Match = require("../models/match");
const { requireAuth, authorize } = require("../middlewares/auth");
const { getTournamentInfo, getStandings } = require("../services/footballAPI");

const router = express.Router();

/* ==========================
   MongoDB CRUD Endpoints
   ========================== */

// ➕ إنشاء بطولة (admin/editor)
router.post("/", requireAuth, authorize("tournament:create"), async (req, res, next) => {
  try {
    const { name, season, country, year } = req.body;
    if (!name || !season || !country || !year) {
      res.status(400);
      throw new Error("name, season, country, year are required");
    }
    const t = await Tournament.create(req.body);
    res.status(201).json({ message: "Tournament created", tournament: t });
  } catch (err) {
    next(err);
  }
});

// 📌 كل البطولات
router.get("/", async (req, res, next) => {
  try {
    const tournaments = await Tournament.find().populate("teams", "name country logo");
    res.json(tournaments);
  } catch (err) {
    next(err);
  }
});

// 📌 بطولة واحدة
router.get("/:id", async (req, res, next) => {
  try {
    const t = await Tournament.findById(req.params.id).populate("teams", "name country logo");
    if (!t) {
      res.status(404);
      throw new Error("Tournament not found");
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
});

// ✏️ تحديث بطولة
router.put("/:id", requireAuth, authorize("tournament:update"), async (req, res, next) => {
  try {
    const updated = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      res.status(404);
      throw new Error("Tournament not found");
    }
    res.json({ message: "Tournament updated", tournament: updated });
  } catch (err) {
    next(err);
  }
});

// 🗑️ حذف بطولة
router.delete("/:id", requireAuth, authorize("tournament:delete"), async (req, res, next) => {
  try {
    const deleted = await Tournament.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404);
      throw new Error("Tournament not found");
    }
    res.json({ message: "Tournament deleted" });
  } catch (err) {
    next(err);
  }
});

// 📌 الفرق المشاركة في بطولة
router.get("/:id/teams", async (req, res, next) => {
  try {
    const teams = await Team.find({ tournament: req.params.id });
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

// 📌 المباريات في بطولة معينة
router.get("/:id/matches", async (req, res, next) => {
  try {
    const matches = await Match.find({ tournament: req.params.id })
      .populate("homeTeam", "name country logo")
      .populate("awayTeam", "name country logo");
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

/* ==========================
   API-Football Integration
   ========================== */

// 📌 بيانات بطولة من API
router.get("/api/:id", async (req, res, next) => {
  try {
    const tournament = await getTournamentInfo(req.params.id);
    if (!tournament) return res.status(404).json({ message: "Tournament not found in API" });
    res.json(tournament);
  } catch (err) {
    next(err);
  }
});

// 📌 جدول الترتيب من API
router.get("/api/:id/standings", async (req, res, next) => {
  try {
    const season = new Date().getFullYear();
    const standings = await getStandings(req.params.id, season);
    res.json(standings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


