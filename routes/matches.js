const express = require("express");
const router = express.Router();

const {
  getLiveMatches,
  getMatchesByDate
} = require("../services/footballAPI");

/* =========================
   MAIN ENDPOINT USED BY FRONTEND
   ========================= */

// GET /matches?date=YYYY-MM-DD&timezone=Africa/Cairo
router.get("/", async (req, res) => {
  try {
    const { date, timezone = "Africa/Cairo" } = req.query;

    if (!date) {
      return res.json([]);
    }

    console.log(`📅 Fetching matches for: ${date} (${timezone})`);

    const apiData = await getMatchesByDate(date, timezone);

    if (!apiData || apiData.length === 0) {
      return res.json([]);
    }

    const formatted = apiData.map(match => ({
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
        logo: match.league.logo
      },

      updatedAt: new Date()
    }));

    res.json(formatted);

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: "Error fetching matches", error: err.message });
  }
});

/* =========================
   LIVE ENDPOINT USED BY FRONTEND
   ========================= */

router.get("/live", async (req, res) => {
  try {
    const apiData = await getLiveMatches();

    if (!apiData || apiData.length === 0) {
      return res.json([]);
    }

    const formatted = apiData.map(match => ({
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
        country: match.league.country
      },

      isLive: true,
      updatedAt: new Date()
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching live matches" });
  }
});

module.exports = router;
