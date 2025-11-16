// routes/matches.js
const express = require("express");
const router = express.Router();
const { filterMatches } = require("../middleware/leagueFilter");

// API functions used by frontend
const {
  getLiveMatches,
  getMatchesByDate
} = require("../services/footballAPI");

/* =========================
   PUBLIC: DATABASE ENDPOINTS
   ========================= */

// GET /matches (Matches from API-Football with optional date filtering)
router.get("/", async (req, res) => {
  try {
    const { date, timezone, league, live } = req.query;
    
    // If date is provided, fetch from API-Football
    if (date) {
      // Use timezone from frontend or default to UTC
      const userTimezone = timezone || 'UTC';
      console.log(`📅 Fetching matches for date: ${date} (timezone: ${userTimezone})`);
      
      // Fetch matches from API-Football for the specified date
      const apiData = await getMatchesByDate(date, userTimezone);
      console.log(`📡 API Matches Response: ${apiData?.length || 0}`);
      
      if (!apiData || apiData.length === 0) {
        console.log("⚠️ No matches found for the specified date");
        return res.json([]);
      }

      //  priority sorting
      // Get dynamic priority order from leagues configuration
      const { getAllowedLeagues } = require('../config/leagues');
      const allowedLeagues = getAllowedLeagues();
      const priorityOrder = allowedLeagues
        .sort((a, b) => a.priority - b.priority)
        .map(league => league.id);
      
      let formattedMatches = apiData.map(match => ({
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
          country: match.league.country,
          id: match.league.id,
          logo: match.league.logo
        },
        timezone: userTimezone,
        updatedAt: new Date(),
        // Add priority for sorting
        priority: priorityOrder.indexOf(match.league.id)
      }));

      // Apply league filtering (same as HTML template)
      if (league && league !== 'all') {
        const leagueId = parseInt(league);
        formattedMatches = formattedMatches.filter(match => match.tournament.id === leagueId);
        console.log(`🔍 Filtered by league ${leagueId}: ${formattedMatches.length} matches`);
      }

      if (live === 'true') {
        const liveStatuses = ['1H', 'HT', '2H', 'ET', 'P'];
        formattedMatches = formattedMatches.filter(match => liveStatuses.includes(match.status));
        console.log(`🔴 Filtered live matches: ${formattedMatches.length} matches`);
      }

      // Apply league filtering to only show allowed leagues
      formattedMatches = filterMatches(formattedMatches);
      console.log(`🔍 League Filter: ${formattedMatches.length} matches after filtering`);

      // Sort matches by priority (same as HTML template)
      formattedMatches.sort((a, b) => {
        const aPrio = a.priority;
        const bPrio = b.priority;
        
        if (aPrio !== -1 && bPrio !== -1) return aPrio - bPrio; // Both are important
        if (aPrio !== -1) return -1; // a is important, b is not
        if (bPrio !== -1) return 1; // b is important, a is not
        
        return a.tournament.name.localeCompare(b.tournament.name); // Neither is important, sort alphabetically
      });

      console.log(`✅ Returning ${formattedMatches.length} matches for ${date}`);
      return res.json(formattedMatches);
    }
    
    // If no date provided, return empty array
    res.json([]);
  } catch (err) {
    console.error("❌ Error fetching matches:", err);
    res.status(500).json({ message: "Error fetching matches", error: err.message });
  }
});


// GET /matches/live (Real-time from API-Football)
router.get("/live", async (req, res) => {
  try {
    console.log("🔴 Fetching live matches from API-Football...");
    
    // Always fetch fresh live data from API-Football for real-time updates
    const apiData = await getLiveMatches();
    console.log(`📡 API Live Matches Response: ${apiData?.length || 0}`);
    
    if (!apiData || apiData.length === 0) {
      console.log("⚠️ No live matches found from API");
      return res.json([]);
    }

    // Transform API data to match our frontend format with live indicators
    const liveMatches = apiData.map(match => {
      const status = match.fixture.status.short;
      const elapsed = match.fixture.status.elapsed;
      
      // Determine live status and display text
      let liveStatus = "LIVE";
      let liveDisplay = "";
      let isLive = false;
      
      if (status === "LIVE" || status === "1H" || status === "2H" || status === "HT") {
        isLive = true;
        if (status === "HT") {
          liveDisplay = "HT";
        } else if (status === "1H") {
          liveDisplay = elapsed ? `${elapsed}'` : "1H";
        } else if (status === "2H") {
          liveDisplay = elapsed ? `${elapsed}'` : "2H";
        } else {
          liveDisplay = elapsed ? `${elapsed}'` : "LIVE";
        }
      }
      
      return {
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
        status: status.toLowerCase(),
        minute: elapsed || 0,
        liveStatus: liveStatus,
        liveDisplay: liveDisplay,
        isLive: isLive,
        venue: match.fixture.venue?.name || "Unknown Venue",
        tournament: {
          name: match.league.name,
          country: match.league.country,
          id: match.league.id
        },
        updatedAt: new Date()
      };
    });

    // Apply league filtering to only show allowed leagues
    const filteredLiveMatches = filterMatches(liveMatches);
    console.log(`🔍 League Filter: ${liveMatches.length} → ${filteredLiveMatches.length} live matches after filtering`);

    console.log(`✅ Returning ${filteredLiveMatches.length} live matches directly from API`);
    res.json(filteredLiveMatches);
  } catch (err) {
    console.error("❌ Error fetching live matches:", err);
    res.status(500).json({ error: "Error fetching live matches", details: err.message });
  }
});



module.exports = router;