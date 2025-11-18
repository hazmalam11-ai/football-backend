const express = require("express");
const router = express.Router();
const { filterMatches } = require("../middleware/leagueFilter");
const {
  getLiveMatches,
  getMatchesByDate
} = require("../services/footballAPI");

// ============================
// GET /api/football/matches/today
// ============================
router.get("/today", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;

    const today = new Date().toISOString().split("T")[0];

    const apiData = await getMatchesByDate(today, timezone);

    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: match.fixture.status.short === "LIVE"
    }));

    res.json(filterMatches(formatted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET /yesterday
// ============================
router.get("/yesterday", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;

    let date = new Date();
    date.setDate(date.getDate() - 1);
    date = date.toISOString().split("T")[0];

    const apiData = await getMatchesByDate(date, timezone);

    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: match.fixture.status.short === "LIVE"
    }));

    res.json(filterMatches(formatted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET /tomorrow
// ============================
router.get("/tomorrow", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;

    let date = new Date();
    date.setDate(date.getDate() + 1);
    date = date.toISOString().split("T")[0];

    const apiData = await getMatchesByDate(date, timezone);

    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: match.fixture.status.short === "LIVE"
    }));

    res.json(filterMatches(formatted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET /live
// ============================
router.get("/live", async (req, res) => {
  try {
    const apiData = await getLiveMatches();

    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short.toLowerCase(),
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: true
    }));

    res.json(filterMatches(formatted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET /?date=YYYY-MM-DD
// ============================
router.get("/", async (req, res) => {
  try {
    const { date, timezone = "Africa/Cairo" } = req.query;
    if (!date) return res.json([]);

    const apiData = await getMatchesByDate(date, timezone);

    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: match.fixture.status.short === "LIVE"
    }));

    res.json(filterMatches(formatted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
