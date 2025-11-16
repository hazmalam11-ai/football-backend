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

// ✅ مباريات مباشرة - Real-time from API
router.get("/matches/live", async (req, res) => {
  try {
    console.log("🔴 Fetching live matches from API-Football...");
    
    // Always fetch fresh live data from API-Football for real-time updates
    const apiData = await footballAPI.getLiveMatches();
    console.log(`📡 API Live Matches Response: ${apiData?.length || 0}`);
    
    if (!apiData || apiData.length === 0) {
      console.log("⚠️ No live matches found from API");
      return res.json([]);
    }

    // Transform API data to match our frontend format
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
      status: match.fixture.status.short === "LIVE" ? "live" : match.fixture.status.short.toLowerCase(),
      minute: match.fixture.status.elapsed || 0,
      venue: match.fixture.venue?.name || "Unknown Venue",
      tournament: {
        name: match.league.name,
        country: match.league.country,
        id: match.league.id
      },
      isLive: true,
      updatedAt: new Date()
    }));

    // Apply league filtering to only show allowed leagues
    const filteredLiveMatches = filterMatches(liveMatches);
    console.log(`🔍 League Filter: ${liveMatches.length} → ${filteredLiveMatches.length} live matches after filtering`);

    console.log(`✅ Returning ${filteredLiveMatches.length} live matches`);
    res.json(filteredLiveMatches);
  } catch (err) {
    console.error("❌ Error fetching live matches:", err);
    res.status(500).json({ error: "Error fetching live matches", details: err.message });
  }
});

// ✅ مباريات اليوم
router.get("/matches/today", async (req, res) => {
  try {
    const { league } = req.query;
    const matches = await footballAPI.getTodayMatches(league);
    
    // Apply league filtering to only show allowed leagues
    const filteredMatches = filterMatches(matches);
    console.log(`🔍 League Filter: ${matches.length} → ${filteredMatches.length} today's matches after filtering`);
    
    res.json(filteredMatches);
  } catch (err) {
    res.status(500).json({ message: "Error fetching today's matches", error: err.message });
  }
});

// ✅ مباراة معينة بالـ ID
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
   Tournaments & Standings
======================== */

// ✅ البطولات
router.get("/tournaments", async (req, res) => {
  try {
    const { country, season } = req.query;
    let tournaments = await Tournament.find({ country, season });

    if (!tournaments.length) {
      const apiData = await footballAPI.getLeagues(country, season); // API-Sports بتسميها leagues
      tournaments = await Tournament.insertMany(apiData, { ordered: false }).catch(() =>
        Tournament.find({ country, season })
      );
    }

    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: "Error fetching tournaments", details: err.message });
  }
});

// ✅ ترتيب البطولة
router.get("/standings/:tournament/:season", async (req, res) => {
  try {
    const { tournament, season } = req.params;
    console.log(`🔍 Fetching standings for tournament: ${tournament}, season: ${season}`);
    
    // Directly call API-Football API without database operations
    const standings = await footballAPI.getStandings(tournament, season);
    console.log(`✅ Retrieved ${standings.length} teams from API-Football`);
    
    res.json(standings);
  } catch (err) {
    console.error("❌ Error fetching standings:", err);
    res.status(500).json({ 
      error: "Error fetching standings", 
      details: err.message,
      tournament: req.params.tournament,
      season: req.params.season
    });
  }
});

/* ========================
   Teams & Players
======================== */

// ✅ معلومات فريق
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

// ✅ لاعبي فريق
router.get("/teams/:id/players/:season", async (req, res) => {
  try {
    const { id, season } = req.params;
    console.log(`⚽ Fetching players for team: ${id}, season: ${season}`);
    
    // Directly call API-Football API without database operations
    const players = await footballAPI.getTeamPlayers(id, season);
    console.log(`✅ Retrieved ${players.length} players for team ${id}`);
    
    res.json(players);
  } catch (err) {
    console.error("❌ Error fetching team players:", err);
    res.status(500).json({ 
      error: "Error fetching team players", 
      details: err.message,
      teamId: req.params.id,
      season: req.params.season
    });
  }
});

// ✅ فرق الدوري
router.get("/teams/:leagueId/:season", async (req, res) => {
  try {
    const { leagueId, season } = req.params;
    console.log(`⚽ Fetching teams for league: ${leagueId}, season: ${season}`);
    
    const teams = await footballAPI.getTeamsByLeague(leagueId, season);
    console.log(`✅ Retrieved ${teams.length} teams for league ${leagueId}`);
    
    res.json(teams);
  } catch (err) {
    console.error("❌ Error fetching teams by league:", err);
    res.status(500).json({ 
      error: "Error fetching teams by league", 
      details: err.message,
      leagueId: req.params.leagueId,
      season: req.params.season
    });
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
   System Stats
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

// GET /api/football/statistics/:matchId (Match statistics)
router.get("/statistics/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`📊 Fetching statistics for match: ${matchId}`);
    
    const statistics = await footballAPI.getMatchStatistics(matchId);
    console.log(`✅ Retrieved statistics for match ${matchId}`);
    
    res.json(statistics);
  } catch (err) {
    console.error("❌ Error fetching match statistics:", err);
    res.status(500).json({ 
      error: "Error fetching match statistics", 
      details: err.message,
      matchId: req.params.matchId
    });
  }
});

// GET /api/football/events/:matchId (Match events)
router.get("/events/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`⚽ Fetching events for match: ${matchId}`);
    
    const events = await footballAPI.getMatchEvents(matchId);
    console.log(`✅ Retrieved ${events.length} events for match ${matchId}`);
    
    res.json(events);
  } catch (err) {
    console.error("❌ Error fetching match events:", err);
    res.status(500).json({ 
      error: "Error fetching match events", 
      details: err.message,
      matchId: req.params.matchId
    });
  }
});

// GET /api/football/lineups/:matchId (Match lineups)
router.get("/lineups/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(`🧩 Fetching lineups for match: ${matchId}`);

    const lineups = await footballAPI.getMatchLineups(matchId);
    console.log(`✅ Retrieved ${lineups.length} lineup entries for match ${matchId}`);

    res.json(lineups);
  } catch (err) {
    console.error("❌ Error fetching match lineups:", err);
    res.status(500).json({ 
      error: "Error fetching match lineups", 
      details: err.message,
      matchId: req.params.matchId
    });
  }
});

module.exports = router;