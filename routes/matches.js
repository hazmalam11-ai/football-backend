// routes/matches.js
const express = require("express");
const router = express.Router();

const {
  getLiveMatches,
  getMatchesByDate,
  getTodayMatches
} = require("../services/footballAPI");

/* =========================
   GET /matches/today
   ========================= */
router.get("/today", async (req, res) => {
  try {
    const timezone = "Africa/Cairo";

    const apiMatches = await getTodayMatches(timezone);

    if (!apiMatches || apiMatches.length === 0) {
      return res.json([]);
    }

    const formatted = apiMatches.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: {
        name: match.teams.home.name,
        logo: match.teams.home.logo,
        id: match.teams.home.id,
      },
      awayTeam: {
        name: match.teams.away.name,
        logo: match.teams.away.logo,
        id: match.teams.away.id,
      },
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: {
        name: match.league.name,
        id: match.league.id,
        country: match.league.country,
        logo: match.league.logo,
      },
      isLive: ["1H", "2H", "HT", "LIVE"].includes(match.fixture.status.short),
      updatedAt: new Date(),
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching today's matches", error: err.message });
  }
});


/* =========================
   GET /matches/yesterday
   ========================= */
router.get("/yesterday", async (req, res) => {
  try {
    const timezone = "Africa/Cairo";

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split("T")[0];

    const apiMatches = await getMatchesByDate(dateString, timezone);

    if (!apiMatches || apiMatches.length === 0) {
      return res.json([]);
    }

    const formatted = apiMatches.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: {
        name: match.teams.home.name,
        logo: match.teams.home.logo,
        id: match.teams.home.id,
      },
      awayTeam: {
        name: match.teams.away.name,
        logo: match.teams.away.logo,
        id: match.teams.away.id,
      },
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: {
        name: match.league.name,
        id: match.league.id,
        country: match.league.country,
        logo: match.league.logo,
      },
      updatedAt: new Date(),
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching yesterday matches", error: err.message });
  }
});


/* =========================
   GET /matches/tomorrow
   ========================= */
router.get("/tomorrow", async (req, res) => {
  try {
    const timezone = "Africa/Cairo";

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split("T")[0];

    const apiMatches = await getMatchesByDate(dateString, timezone);

    if (!apiMatches || apiMatches.length === 0) {
      return res.json([]);
    }

    const formatted = apiMatches.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: {
        name: match.teams.home.name,
        logo: match.teams.home.logo,
        id: match.teams.home.id,
      },
      awayTeam: {
        name: match.teams.away.name,
        logo: match.teams.away.logo,
        id: match.teams.away.id,
      },
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: {
        name: match.league.name,
        id: match.league.id,
        country: match.league.country,
        logo: match.league.logo,
      },
      updatedAt: new Date(),
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching tomorrow matches", error: err.message });
  }
});


/* =========================
   GET /matches/live
   ========================= */
router.get("/live", async (req, res) => {
  try {
    const apiData = await getLiveMatches();

    if (!apiData || apiData.length === 0) {
      return res.json([]);
    }

    const liveMatches = apiData.map(match => ({
      _id: match.fixture.id.toString(),
      apiId: match.fixture.id,
      homeTeam: {
        name: match.teams.home.name,
        logo: match.teams.home.logo,
        id: match.teams.home.id
      },
      awayTeam: {
        name: match.teams.away.name,
        logo: match.teams.away.logo,
        id: match.teams.away.id
      },
      scoreA: match.goals.home ?? 0,
      scoreB: match.goals.away ?? 0,
      date: match.fixture.date,
      status: match.fixture.status.short,
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: {
        name: match.league.name,
        id: match.league.id,
        country: match.league.country,
        logo: match.league.logo,
      },
      isLive: true,
      updatedAt: new Date()
    }));

    res.json(liveMatches);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching live matches", error: err.message });
  }
});

module.exports = router;
