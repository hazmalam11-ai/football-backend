// routes/matchData.js
const express = require("express");
const router = express.Router();
const matchDataService = require("../services/matchDataService");
const { requireAuth } = require("../middlewares/auth");

// ✅ Get live matches - Real-time from API
router.get("/live", async (req, res) => {
  try {
    console.log("🔴 Fetching live matches from API-Football...");
    
    // Always fetch fresh live data from API-Football for real-time updates
    const liveMatches = await matchDataService.getLiveMatches();
    console.log(`📡 API Live Matches Response: ${liveMatches?.length || 0}`);
    
    if (!liveMatches || liveMatches.length === 0) {
      console.log("⚠️ No live matches found from API");
      return res.json([]);
    }

    // Transform API data to match our frontend format
    const formattedMatches = liveMatches.map(match => ({
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

    console.log(`✅ Returning ${formattedMatches.length} live matches`);
    res.json(formattedMatches);
  } catch (error) {
    console.error("❌ Error fetching live matches:", error);
    res.status(500).json({ error: "Error fetching live matches", details: error.message });
  }
});

// ✅ Get matches by date
router.get("/date/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { leagueId } = req.query;
    
    console.log(`📅 Fetching matches for date: ${date}${leagueId ? ` (league: ${leagueId})` : ''}`);
    const matches = await matchDataService.getMatchesByDate(date, leagueId);
    
    console.log(`✅ Returning ${matches.length} matches for ${date}`);
    res.json(matches);
  } catch (error) {
    console.error("❌ Error fetching matches by date:", error);
    res.status(500).json({ error: "Error fetching matches by date", details: error.message });
  }
});

// ✅ Get match details with player stats
router.get("/match/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    
    console.log(`📊 Fetching match details and player stats for: ${matchId}`);
    const matchDetails = await matchDataService.getMatchDetails(matchId);
    const playerStats = await matchDataService.getMatchPlayerStats(matchId);
    
    if (!matchDetails) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    console.log(`✅ Returning match details and ${playerStats.length} player stats`);
    res.json({
      match: matchDetails,
      playerStats: playerStats
    });
  } catch (error) {
    console.error("❌ Error fetching match details:", error);
    res.status(500).json({ error: "Error fetching match details", details: error.message });
  }
});

// ✅ Sync match data to fantasy teams
router.post("/sync/:matchId", requireAuth, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    console.log(`🔄 Syncing match data to fantasy teams: ${matchId}`);
    const syncedData = await matchDataService.syncMatchToFantasyTeams(matchId);
    
    console.log(`✅ Match data synced successfully`);
    res.json({
      message: "Match data synced successfully",
      data: syncedData
    });
  } catch (error) {
    console.error("❌ Error syncing match data:", error);
    res.status(500).json({ error: "Error syncing match data", details: error.message });
  }
});

// ✅ Get player season statistics
router.get("/player/:playerId/stats", async (req, res) => {
  try {
    const { playerId } = req.params;
    const { season = '2024' } = req.query;
    
    console.log(`📊 Fetching player season stats: ${playerId} (${season})`);
    const playerStats = await matchDataService.getPlayerSeasonStats(playerId, season);
    
    console.log(`✅ Returning player season stats`);
    res.json(playerStats);
  } catch (error) {
    console.error("❌ Error fetching player statistics:", error);
    res.status(500).json({ error: "Error fetching player statistics", details: error.message });
  }
});

// ✅ Get team players
router.get("/team/:teamId/players", async (req, res) => {
  try {
    const { teamId } = req.params;
    const { season = '2024' } = req.query;
    
    console.log(`👥 Fetching team players: ${teamId} (${season})`);
    const teamPlayers = await matchDataService.getTeamPlayers(teamId, season);
    
    console.log(`✅ Returning ${teamPlayers.length} team players`);
    res.json(teamPlayers);
  } catch (error) {
    console.error("❌ Error fetching team players:", error);
    res.status(500).json({ error: "Error fetching team players", details: error.message });
  }
});

// ✅ Get available leagues
router.get("/leagues", async (req, res) => {
  try {
    const { country } = req.query;
    
    console.log(`🏆 Fetching leagues${country ? ` for ${country}` : ''}`);
    const leagues = await matchDataService.getLeagues(country);
    
    console.log(`✅ Returning ${leagues.length} leagues`);
    res.json(leagues);
  } catch (error) {
    console.error("❌ Error fetching leagues:", error);
    res.status(500).json({ error: "Error fetching leagues", details: error.message });
  }
});

// ✅ Get teams by league
router.get("/league/:leagueId/teams", async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { season = '2024' } = req.query;
    
    console.log(`🏟️ Fetching teams for league: ${leagueId} (${season})`);
    const teams = await matchDataService.getTeamsByLeague(leagueId, season);
    
    console.log(`✅ Returning ${teams.length} teams`);
    res.json(teams);
  } catch (error) {
    console.error("❌ Error fetching teams by league:", error);
    res.status(500).json({ error: "Error fetching teams by league", details: error.message });
  }
});

// ✅ Auto-sync all live matches
router.post("/sync-live", requireAuth, async (req, res) => {
  try {
    console.log("🔄 Auto-syncing all live matches...");
    const liveMatches = await matchDataService.getLiveMatches();
    
    if (!liveMatches || liveMatches.length === 0) {
      console.log("⚠️ No live matches found");
      return res.json({
        message: "No live matches found",
        synced: 0
      });
    }

    let syncedCount = 0;
    const results = [];

    for (const match of liveMatches) {
      try {
        console.log(`🔄 Syncing match: ${match.teams.home.name} vs ${match.teams.away.name}`);
        const syncedData = await matchDataService.syncMatchToFantasyTeams(match.fixture.id);
        results.push({
          matchId: match.fixture.id,
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          status: 'synced'
        });
        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing match ${match.fixture.id}:`, error.message);
        results.push({
          matchId: match.fixture.id,
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`✅ Auto-sync completed: ${syncedCount}/${liveMatches.length} matches synced`);
    res.json({
      message: `Synced ${syncedCount} live matches`,
      synced: syncedCount,
      results
    });
  } catch (error) {
    console.error("❌ Error auto-syncing live matches:", error);
    res.status(500).json({ error: "Error auto-syncing live matches", details: error.message });
  }
});

module.exports = router;
