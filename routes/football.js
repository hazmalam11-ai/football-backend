const express = require("express");
const router = express.Router();
const footballAPI = require("../services/footballAPI");
const { filterMatches } = require("../middleware/leagueFilter");

// 📦 المودلز
const Match = require("../models/match");
const Tournament = require("../models/tournament");
const Team = require("../models/Team");
const Player = require("../models/Player");
const News = require("../models/news");

/* ========================
   Matches
======================== */

// ✅ مباريات مباشرة (Real-time)
router.get("/matches/live", async (req, res) => {
  try {
    const apiData = await footballAPI.getLiveMatches();
    if (!apiData || apiData.length === 0) return res.json([]);

    const liveMatches = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short === "LIVE" ? "live" : match.fixture.status.short.toLowerCase(),
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: match.league,
      isLive: true,
      updatedAt: new Date()
    }));

    res.json(filterMatches(liveMatches));
  } catch (err) {
    res.status(500).json({ error: "Error fetching live matches", details: err.message });
  }
});

// ==========================================================
// 🎯 إضافة الروترات التي يحتاجها الفرونت (Today / Yesterday / Tomorrow)
// ==========================================================

// ✅ Today
router.get("/today", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;
    const today = new Date().toISOString().split("T")[0];

    const matches = await footballAPI.getMatchesByDate(today, timezone);
    if (!matches) return res.json([]);

    const mapped = matches.map(match => ({
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

    res.json(filterMatches(mapped));
  } catch (err) {
    res.status(500).json({ error: "Error fetching today's matches", details: err.message });
  }
});

// ✅ Yesterday
router.get("/yesterday", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;

    let date = new Date();
    date.setDate(date.getDate() - 1);
    date = date.toISOString().split("T")[0];

    const matches = await footballAPI.getMatchesByDate(date, timezone);
    if (!matches) return res.json([]);

    const mapped = matches.map(match => ({
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

    res.json(filterMatches(mapped));
  } catch (err) {
    res.status(500).json({ error: "Error fetching yesterday matches", details: err.message });
  }
});

// ✅ Tomorrow
router.get("/tomorrow", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;

    let date = new Date();
    date.setDate(date.getDate() + 1);
    date = date.toISOString().split("T")[0];

    const matches = await footballAPI.getMatchesByDate(date, timezone);
    if (!matches) return res.json([]);

    const mapped = matches.map(match => ({
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

    res.json(filterMatches(mapped));
  } catch (err) {
    res.status(500).json({ error: "Error fetching tomorrow matches", details: err.message });
  }
});

// ==========================================================
// END OF NEW ROUTES
// ==========================================================

// ✅ مباراة واحدة
router.get("/matches/:id", async (req, res) => {
  try {
    let match = await Match.findOne({ apiId: req.params.id });

    if (!match) {
      const apiData = await footballAPI.getMatchById(req.params.id);
      if (apiData) {
        match = await Match.findOneAndUpdate(
          { apiId: apiData.apiId },
          apiData,
          { upsert: true, new: true }
        );
      }
    }

    if (!match) return res.status(404).json({ error: "Match not found" });

    res.json(match);
  } catch (err) {
    res.status(500).json({ error: "Error fetching match by ID", details: err.message });
  }
});

/* ========================
   Leagues & Tournaments
======================== */

router.get("/tournaments", async (req, res) => {
  try {
    const { country, season } = req.query;
    let tournaments = await Tournament.find({ country, season });

    if (!tournaments.length) {
      const apiData = await footballAPI.getLeagues(country, season);
      tournaments = await Tournament.insertMany(apiData, { ordered: false }).catch(() =>
        Tournament.find({ country, season })
      );
    }

    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: "Error fetching tournaments", details: err.message });
  }
});

router.get("/standings/:tournament/:season", async (req, res) => {
  try {
    const { tournament, season } = req.params;

    const standings = await footballAPI.getStandings(tournament, season);
    res.json(standings);
  } catch (err) {
    res.status(500).json({ error: "Error fetching standings", details: err.message });
  }
});

/* ========================
   Teams / Players
======================== */

router.get("/teams/:id", async (req, res) => {
  try {
    let team = await Team.findOne({ apiId: req.params.id });

    if (!team) {
      const apiData = await footballAPI.getTeamInfo(req.params.id);
      team = await Team.create({ ...apiData, apiId: apiData.id });
    }

    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "Error fetching team info", details: err.message });
  }
});

router.get("/teams/:id/players/:season", async (req, res) => {
  try {
    const { id, season } = req.params;

    const players = await footballAPI.getTeamPlayers(id, season);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: "Error fetching team players", details: err.message });
  }
});

router.get("/teams/:leagueId/:season", async (req, res) => {
  try {
    const { leagueId, season } = req.params;

    const teams = await footballAPI.getTeamsByLeague(leagueId, season);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: "Error fetching league teams", details: err.message });
  }
});

/* ========================
   News
======================== */

router.get("/news", async (req, res) => {
  try {
    let news = await News.find().sort({ publishedAt: -1 });

    if (!news.length) {
      const apiData = await footballAPI.getLatestNews();
      news = await News.insertMany(apiData, { ordered: false }).catch(() =>
        News.find().sort({ publishedAt: -1 })
      );
    }

    res.json(news);
  } catch (err) {
    res.status(500).json({ error: "Error fetching news", details: err.message });
  }
});

/* ========================
   Stats / Events / Lineups
======================== */

router.get("/stats", (req, res) => {
  try {
    const data = footballAPI.getUsageStats ? footballAPI.getUsageStats() : {};
    res.json({
      message: "Football API usage stats",
      stats: data,
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching API stats", details: err.message });
  }
});

router.get("/statistics/:matchId", async (req, res) => {
  try {
    const stats = await footballAPI.getMatchStatistics(req.params.matchId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Error fetching match statistics", details: err.message });
  }
});

router.get("/events/:matchId", async (req, res) => {
  try {
    const events = await footballAPI.getMatchEvents(req.params.matchId);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Error fetching match events", details: err.message });
  }
});

router.get("/lineups/:matchId", async (req, res) => {
  try {
    const lineups = await footballAPI.getMatchLineups(req.params.matchId);
    res.json(lineups);
  } catch (err) {
    res.status(500).json({ error: "Error fetching match lineups", details: err.message });
  }
});

module.exports = router;
