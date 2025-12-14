const express = require("express");
const router = express.Router();

const { filterMatches } = require("../middleware/leagueFilter");
const { getLiveMatches, getMatchesByDate } = require("../services/footballAPI");

// ============================
// League priority (custom order)
// Spain -> England -> UCL -> Italy -> others
// ============================
const LEAGUE_PRIORITY = {
  140: 1, // La Liga (Spain)
  39: 2,  // Premier League (England)
  2: 3,   // UEFA Champions League
  135: 4, // Serie A (Italy)
};

// Helper: normalize status across endpoints
function normalizeStatus(short) {
  if (!short) return "";
  return String(short).toUpperCase();
}

// Helper: format match into your frontend contract
function formatMatch(match) {
  return {
    _id: match.fixture.id.toString(),
    apiId: match.fixture.id,
    homeTeam: match.teams.home,
    awayTeam: match.teams.away,
    scoreA: match.goals.home ?? 0,
    scoreB: match.goals.away ?? 0,
    date: match.fixture.date,
    status: normalizeStatus(match.fixture.status.short),
    minute: match.fixture.status.elapsed || 0,
    venue: match.fixture.venue?.name || "Unknown Venue",
    tournament: match.league, // {id,name,country,logo,flag,season,round...}
    isLive: normalizeStatus(match.fixture.status.short) === "LIVE",
  };
}

function getPriority(formattedMatch) {
  const id = formattedMatch?.tournament?.id;
  return LEAGUE_PRIORITY[id] ?? 999;
}

// Sorting rules:
// 1) Priority leagues first
// 2) Live matches first
// 3) Earlier kickoff first
function sortMatches(matches) {
  return matches.sort((a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa !== pb) return pa - pb;

    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;

    return new Date(a.date) - new Date(b.date);
  });
}

// Small caching hints (safe for “today/yesterday/tomorrow”)
// Express best practices recommend proper caching for performance. [web:521]
function setPublicCache(res, seconds) {
  res.set("Cache-Control", `public, max-age=${seconds}, s-maxage=${seconds}`);
}

// ============================
// GET /today
// ============================
router.get("/today", async (req, res) => {
  try {
    const { timezone = "Africa/Cairo" } = req.query;
    const today = new Date().toISOString().split("T")[0];

    const apiData = await getMatchesByDate(today, timezone);
    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(formatMatch);
    const filtered = filterMatches(formatted);
    const sorted = sortMatches(filtered);

    setPublicCache(res, 30);
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    const formatted = apiData.map(formatMatch);
    const filtered = filterMatches(formatted);
    const sorted = sortMatches(filtered);

    setPublicCache(res, 60 * 10);
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    const formatted = apiData.map(formatMatch);
    const filtered = filterMatches(formatted);
    const sorted = sortMatches(filtered);

    setPublicCache(res, 60 * 10);
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================
// GET /live
// ============================
router.get("/live", async (req, res) => {
  try {
    const apiData = await getLiveMatches();
    if (!apiData || apiData.length === 0) return res.json([]);

    const formatted = apiData.map(formatMatch);

    // live endpoint: all should be live, but keep logic consistent
    const filtered = filterMatches(formatted);
    const sorted = sortMatches(filtered);

    setPublicCache(res, 10);
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    const formatted = apiData.map(formatMatch);
    const filtered = filterMatches(formatted);
    const sorted = sortMatches(filtered);

    // arbitrary date: cache a bit but not too long
    setPublicCache(res, 60 * 5);
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
