const express = require("express");
const router = express.Router();
const Gameweek = require("../models/Gameweek");
const Match = require("../models/match");
const ExternalMatch = require("../models/ExternalMatch");
const { requireAuth } = require("../middlewares/auth");
const axios = require("axios");

// API-Football configuration
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY;

// Helper function to make API-Football requests
const makeApiRequest = async (endpoint, params = {}) => {
  try {
    if (!API_KEY || API_KEY === 'your_api_football_key_here') {
      throw new Error('API-Football key not configured. Please set FOOTBALL_API_KEY in your .env file');
    }

    console.log(`🌐 Making API request to: ${endpoint}`, params);
    
    const response = await axios.get(`${API_FOOTBALL_BASE}${endpoint}`, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': 'v3.football.api-sports.io'
      },
      params
    });
    
    console.log(`✅ API response status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error('❌ API-Football request failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(`API request failed: ${error.message}`);
  }
};

// ===============================
// ✅ Get all gameweeks
// ===============================
router.get("/", async (req, res) => {
  try {
    const gameweeks = await Gameweek.find()
      .populate("matches")
      .populate("externalMatches")
      .sort({ number: 1 });

    // Format response to show match IDs clearly
    const formattedGameweeks = gameweeks.map(gameweek => ({
      ...gameweek.toObject(),
      matchIds: gameweek.externalMatches?.map(match => match.apiId) || [],
      matchCount: gameweek.externalMatches?.length || 0,
      internalMatchIds: gameweek.matches?.map(match => match.apiId) || [],
      internalMatchCount: gameweek.matches?.length || 0
    }));

    res.json(formattedGameweeks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Get current active gameweek
// ===============================
router.get("/current", async (req, res) => {
  try {
    const gameweek = await Gameweek.findOne({ isActive: true })
      .populate("matches")
      .populate("externalMatches");
    
    if (!gameweek) {
      return res.json({ message: "No active gameweek" });
    }

    // Format response to show match IDs clearly
    const formattedGameweek = {
      ...gameweek.toObject(),
      matchIds: gameweek.externalMatches?.map(match => match.apiId) || [],
      matchCount: gameweek.externalMatches?.length || 0,
      internalMatchIds: gameweek.matches?.map(match => match.apiId) || [],
      internalMatchCount: gameweek.matches?.length || 0
    };

    res.json(formattedGameweek);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Get specific gameweek
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const gameweek = await Gameweek.findById(req.params.id)
      .populate("matches")
      .populate("externalMatches");
    
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    // Format response to show match IDs clearly
    const formattedGameweek = {
      ...gameweek.toObject(),
      matchIds: gameweek.externalMatches?.map(match => match.apiId) || [],
      matchCount: gameweek.externalMatches?.length || 0,
      internalMatchIds: gameweek.matches?.map(match => match.apiId) || [],
      internalMatchCount: gameweek.matches?.length || 0
    };

    res.json(formattedGameweek);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Get match details by ID
// ===============================
router.get("/match/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    
    console.log(`📊 Fetching match details for ID: ${matchId}`);
    
    // Get match details from API-Football
    const matchDataService = require("../services/matchDataService");
    const matchDetails = await matchDataService.getMatchDetails(matchId);
    
    if (!matchDetails) {
      return res.status(404).json({ error: "Match not found" });
    }

    // Get player statistics for this match
    const playerStats = await matchDataService.getMatchPlayerStats(matchId);
    
    res.json({
      match: matchDetails,
      playerStats: playerStats,
      matchId: parseInt(matchId)
    });
  } catch (err) {
    console.error("❌ Error fetching match details:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Create new gameweek (Admin only)
// ===============================
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, startDate, endDate, isActive = false, matchData = [] } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "Name, start date, and end date are required" });
    }

    // Check if there's already an active gameweek
    if (isActive) {
      await Gameweek.updateMany({}, { isActive: false });
    }

    // Get the next gameweek number
    const lastGameweek = await Gameweek.findOne().sort({ number: -1 });
    const nextNumber = lastGameweek ? lastGameweek.number + 1 : 1;

    const gameweek = await Gameweek.create({
      number: nextNumber,
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      matches: [],
      externalMatches: []
    });

    // If match data is provided, create ExternalMatch documents
    if (matchData && matchData.length > 0) {
      const externalMatchIds = [];
      
      for (const match of matchData) {
        // Check if match already exists
        let externalMatch = await ExternalMatch.findOne({ apiId: match.fixture.id });
        
        if (!externalMatch) {
          // Create new ExternalMatch document
          externalMatch = await ExternalMatch.create({
            apiId: match.fixture.id,
            fixture: match.fixture,
            league: match.league,
            teams: match.teams,
            goals: match.goals,
            score: match.score,
            matchType: match.matchType || "Regular Match",
            season: match.league.season,
            leagueId: match.league.id
          });
        }
        
        externalMatchIds.push(externalMatch._id);
      }
      
      // Update gameweek with external match references
      gameweek.externalMatches = externalMatchIds;
      await gameweek.save();
    }

    // Populate the external matches for the response
    await gameweek.populate('externalMatches');

    res.status(201).json({ message: "Gameweek created successfully", gameweek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Update gameweek (Admin only)
// ===============================
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, startDate, endDate, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      // If activating this gameweek, deactivate others
      if (isActive) {
        await Gameweek.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
      }
    }

    const gameweek = await Gameweek.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("matches");

    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    res.json({ message: "Gameweek updated successfully", gameweek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Delete gameweek (Admin only)
// ===============================
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const gameweek = await Gameweek.findByIdAndDelete(req.params.id);
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    res.json({ message: "Gameweek deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Get available matches for admin selection
// ===============================
router.get("/admin/available-matches", requireAuth, async (req, res) => {
  try {
    console.log("🔍 Fetching available matches for admin selection...");
    
    // Get live matches
    const matchDataService = require("../services/matchDataService");
    const liveMatches = await matchDataService.getLiveMatches();
    
    // Get today's matches
    const today = new Date().toISOString().split('T')[0];
    const todayMatches = await matchDataService.getMatchesByDate(today);
    
    // Get tomorrow's matches
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowMatches = await matchDataService.getMatchesByDate(tomorrowStr);
    
    // Combine all matches and remove duplicates
    const allMatches = [...liveMatches, ...todayMatches, ...tomorrowMatches];
    const uniqueMatches = allMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.fixture.id === match.fixture.id)
    );
    
    // Format matches for admin selection
    const formattedMatches = uniqueMatches.map(match => ({
      matchId: match.fixture.id,
      homeTeam: {
        id: match.teams.home.id,
        name: match.teams.home.name,
        logo: match.teams.home.logo
      },
      awayTeam: {
        id: match.teams.away.id,
        name: match.teams.away.name,
        logo: match.teams.away.logo
      },
      date: match.fixture.date,
      status: match.fixture.status.short,
      venue: match.fixture.venue?.name || 'Unknown',
      league: {
        id: match.league.id,
        name: match.league.name,
        country: match.league.country,
        logo: match.league.logo
      },
      goals: match.goals
    }));
    
    console.log(`✅ Found ${formattedMatches.length} available matches`);
    res.json({
      success: true,
      matches: formattedMatches,
      total: formattedMatches.length,
      live: liveMatches.length,
      today: todayMatches.length,
      tomorrow: tomorrowMatches.length
    });
  } catch (err) {
    console.error("❌ Error fetching available matches:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// ===============================
// ✅ Fetch El Clásico matches (Barcelona vs Real Madrid) from API-Football
// ===============================
router.get("/api/fetch-matches", requireAuth, async (req, res) => {
  try {
    // Use current season (2025) for El Clásico matches
    const currentYear = new Date().getFullYear();
    const { season = currentYear, league = 140 } = req.query; // 140 = La Liga, default to current year (2025)
    
    console.log("🔍 Fetching El Clásico matches for season:", season, "league:", league);
    console.log("📅 Focusing on current season (2025) for El Clásico matches");

    // Get teams first to find Real Madrid and Barcelona IDs
    const teamsResponse = await makeApiRequest("/teams", { league, season });
    const teams = teamsResponse.response || [];

    // Find Real Madrid and Barcelona with more specific matching
    const realMadrid = teams.find(team => 
      team.team.name.toLowerCase().includes("real madrid") || 
      (team.team.name.toLowerCase().includes("madrid") && !team.team.name.toLowerCase().includes("atletico"))
    );
    const barcelona = teams.find(team => 
      team.team.name.toLowerCase().includes("barcelona") || 
      team.team.name.toLowerCase().includes("barca")
    );

    console.log("🔍 Available teams:", teams.map(t => t.team.name));
    console.log("⚪ Found Real Madrid:", realMadrid?.team.name);
    console.log("🔵 Found Barcelona:", barcelona?.team.name);

    // If Real Madrid not found by name, try to find by known IDs
    let finalRealMadrid = realMadrid;
    if (!realMadrid) {
      console.log("⚠️ Real Madrid not found by name, trying by known IDs...");
      // Try common Real Madrid IDs
      const realMadridIds = [541, 541, 541]; // Real Madrid ID
      for (const id of realMadridIds) {
        finalRealMadrid = teams.find(team => team.team.id === id);
        if (finalRealMadrid) {
          console.log("✅ Found Real Madrid by ID:", finalRealMadrid.team.name);
          break;
        }
      }
      
      // If still not found, create a mock Real Madrid entry
      if (!finalRealMadrid) {
        console.log("⚠️ Real Madrid not found in API, using known data...");
        finalRealMadrid = {
          team: {
            id: 541,
            name: "Real Madrid",
            logo: "https://media.api-sports.io/football/teams/541.png"
          }
        };
      }
    }

    // If Barcelona not found, create a mock entry
    let finalBarcelona = barcelona;
    if (!barcelona) {
      console.log("⚠️ Barcelona not found in API, using known data...");
      finalBarcelona = {
        team: {
          id: 529,
          name: "Barcelona",
          logo: "https://media.api-sports.io/football/teams/529.png"
        }
      };
    }

    if (!finalRealMadrid || !finalBarcelona) {
      return res.status(404).json({ 
        error: "Real Madrid or Barcelona not found in La Liga",
        availableTeams: teams.map(t => ({ id: t.team.id, name: t.team.name })),
        debug: {
          realMadridFound: !!finalRealMadrid,
          barcelonaFound: !!finalBarcelona,
          totalTeams: teams.length
        }
      });
    }

    console.log("🎯 Using teams:", {
      realMadrid: finalRealMadrid.team.name,
      barcelona: finalBarcelona.team.name
    });

    // Fetch ONLY El Clásico matches (Barcelona vs Real Madrid)
    let clasicoMatches;
    let matches = [];
    let seasonsToTry = [season, 2025]; // Try multiple seasons
    let matchesFound = false; // Flag to prevent unnecessary API calls

    for (const trySeason of seasonsToTry) {
      if (matchesFound) break; // Stop if we already found matches
      
      console.log(`🔍 Trying season ${trySeason}...`);
      
      try {
        // Use head-to-head endpoint as specified: /fixtures/headtohead?h2h=541-529&league=140&season=2025
        clasicoMatches = await makeApiRequest("/fixtures/headtohead", { 
          h2h: `${finalRealMadrid.team.id}-${finalBarcelona.team.id}`, // 541-529 format
          season: trySeason,
          league
        });

        console.log(`📊 Head-to-Head API response for season ${trySeason}:`, {
          totalMatches: clasicoMatches.results,
          matches: clasicoMatches.response?.length || 0
        });

        matches = clasicoMatches.response || [];

        // If no matches found with head-to-head, try alternative method
        if (matches.length === 0) {
          console.log(`⚠️ No matches found with head-to-head for season ${trySeason}, trying alternative method...`);
          
          // Fetch all fixtures for the season and filter manually
          const allFixtures = await makeApiRequest("/fixtures", { 
            season: trySeason,
            league,
            last: 100 // Get more matches to filter from
          });

          console.log(`📊 All fixtures response for season ${trySeason}:`, {
            totalMatches: allFixtures.results,
            matches: allFixtures.response?.length || 0
          });

          const allMatches = allFixtures.response || [];
          
          // Filter for El Clásico matches
          matches = allMatches.filter(match => {
            const homeId = match.teams.home.id;
            const awayId = match.teams.away.id;
            return (homeId === finalBarcelona.team.id && awayId === finalRealMadrid.team.id) ||
                   (homeId === finalRealMadrid.team.id && awayId === finalBarcelona.team.id);
          });

          console.log(`🔍 Filtered El Clásico matches for season ${trySeason}:`, matches.length);
        }

        // If we found matches, break out of the loop
        if (matches.length > 0) {
          console.log(`✅ Found ${matches.length} El Clásico matches in season ${trySeason}`);
          matchesFound = true;
          break;
        }
      } catch (error) {
        console.error(`❌ Error fetching matches for season ${trySeason}:`, error.message);
        continue; // Try next season
      }
    }

    // If still no matches found, try without season filter
    if (matches.length === 0) {
      console.log("⚠️ No matches found in any season, trying head-to-head without season filter...");
      try {
        // Use head-to-head without season filter
        const allTimeFixtures = await makeApiRequest("/fixtures/headtohead", { 
          h2h: `${finalRealMadrid.team.id}-${finalBarcelona.team.id}`,
          league
        });

        matches = allTimeFixtures.response || [];
        console.log("🔍 All-time El Clásico matches (head-to-head):", matches.length);
      } catch (error) {
        console.error("❌ Error fetching all-time matches:", error.message);
      }
    }

    // No mock data - only return real API results
    if (matches.length === 0) {
      console.log("⚠️ No real El Clásico matches found in any season");
      console.log("📊 Returning empty matches array - no mock data provided");
    }

    // Remove duplicates based on fixture ID
    const uniqueMatches = matches.filter((match, index, self) => 
      index === self.findIndex(m => m.fixture.id === match.fixture.id)
    );

    console.log("🔍 Duplicates removed:", matches.length - uniqueMatches.length, "duplicates found");

    // Sort matches by date descending (newest first)
    const elClasicoMatches = uniqueMatches.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

    console.log("🏆 Final El Clásico matches found:", elClasicoMatches.length);

    res.json({
      teams: {
        realMadrid: {
          id: finalRealMadrid.team.id,
          name: finalRealMadrid.team.name,
          logo: finalRealMadrid.team.logo
        },
        barcelona: {
          id: finalBarcelona.team.id,
          name: finalBarcelona.team.name,
          logo: finalBarcelona.team.logo
        }
      },
      matches: elClasicoMatches,
      season,
      league,
      matchType: "El Clásico",
      debug: {
        totalApiMatches: matches.length,
        filteredMatches: elClasicoMatches.length,
        teamIds: {
          barcelona: finalBarcelona.team.id,
          realMadrid: finalRealMadrid.team.id
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Add matches to gameweek (Admin only)
// ===============================
router.post("/:id/matches", requireAuth, async (req, res) => {
  try {
    const { matchIds, autoSync = true } = req.body;

    if (!matchIds || !Array.isArray(matchIds)) {
      return res.status(400).json({ error: "Match IDs array is required" });
    }

    const gameweek = await Gameweek.findById(req.params.id);
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    console.log(`➕ Adding ${matchIds.length} matches to gameweek ${gameweek.number}...`);
    console.log(`📋 Match IDs: ${matchIds.join(', ')}`);

    // Create match documents for the selected matches
    const matches = [];
    const externalMatches = [];
    const matchDetails = [];
    const errors = [];
    
    for (const matchId of matchIds) {
      try {
        console.log(`🔍 Processing match ID: ${matchId}`);
        
        // For fantasy scoring, we only need ExternalMatch, not internal Match
        // Skip internal Match creation for now

        // Always fetch latest match details from API-Football for API matches
        const matchDataService = require("../services/matchDataService");
        const details = await matchDataService.getMatchDetails(matchId);
        
        let externalMatch;
        if (details) {
          // Convert API data to ExternalMatch format
          const externalMatchData = matchDataService.convertToExternalMatchFormat(details);
          
          // Always update/create with latest API data (force refresh)
          externalMatch = await ExternalMatch.findOneAndUpdate(
            { apiId: matchId },
            externalMatchData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          
          // Store match details for response
          matchDetails.push({
            matchId: parseInt(matchId),
            homeTeam: details.teams.home.name,
            awayTeam: details.teams.away.name,
            date: details.fixture.date,
            status: details.fixture.status.short,
            venue: details.fixture.venue?.name || 'Unknown',
            league: details.league.name
          });
          
          console.log(`✅ Created/Updated external match for ID: ${matchId} - ${details.teams.home.name} vs ${details.teams.away.name} with latest API data`);
          console.log(`📅 Match date from API: ${details.fixture.date}`);
        } else {
          console.error(`❌ No match details found for ID: ${matchId}`);
          errors.push({ matchId, error: "No match details found in API" });
        }
        
        if (externalMatch) {
          externalMatches.push(externalMatch._id);
        }
      } catch (error) {
        console.error(`❌ Error processing match ${matchId}:`, error.message);
        errors.push({ matchId, error: error.message });
      }
    }

    // Add matches to gameweek
    gameweek.matches = [...new Set([...gameweek.matches, ...matches])];
    gameweek.externalMatches = [...new Set([...gameweek.externalMatches, ...externalMatches])];
    await gameweek.save();

    // Auto-sync match data if requested
    let syncResults = [];
    if (autoSync) {
      console.log(`🔄 Auto-syncing match data for ${matchIds.length} matches...`);
      const matchDataService = require("../services/matchDataService");
      
      for (const matchId of matchIds) {
        try {
          await matchDataService.syncMatchToFantasyTeams(matchId);
          syncResults.push({ matchId, status: 'synced' });
        } catch (error) {
          console.error(`❌ Error syncing match ${matchId}:`, error.message);
          syncResults.push({ matchId, status: 'error', error: error.message });
        }
      }
    }

    const updatedGameweek = await Gameweek.findById(req.params.id)
      .populate("matches")
      .populate("externalMatches");

    console.log(`✅ Added ${matches.length} matches to gameweek ${gameweek.number}`);
    if (autoSync) {
      console.log(`🔄 Auto-sync results: ${syncResults.filter(r => r.status === 'synced').length}/${syncResults.length} synced`);
    }

    res.json({ 
      success: true,
      message: "Matches added to gameweek successfully", 
      gameweek: {
        ...updatedGameweek.toObject(),
        matchIds: updatedGameweek.externalMatches?.map(match => match.apiId) || [],
        matchCount: updatedGameweek.externalMatches?.length || 0
      },
      addedMatches: matchDetails,
      syncResults: autoSync ? syncResults : null,
      errors: errors.length > 0 ? errors : null
    });
  } catch (err) {
    console.error("❌ Error adding matches to gameweek:", err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      details: "Failed to add matches to gameweek"
    });
  }
});

// ===============================
// ✅ Remove match from gameweek (Admin only)
// ===============================
router.delete("/:id/matches/:matchId", requireAuth, async (req, res) => {
  try {
    const gameweek = await Gameweek.findById(req.params.id);
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    gameweek.matches = gameweek.matches.filter(
      matchId => matchId.toString() !== req.params.matchId
    );
    await gameweek.save();

    const updatedGameweek = await Gameweek.findById(req.params.id).populate("matches");
    res.json({ 
      message: "Match removed from gameweek successfully", 
      gameweek: updatedGameweek 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Activate gameweek (Admin only)
// ===============================
router.post("/:id/activate", requireAuth, async (req, res) => {
  try {
    // Deactivate all other gameweeks
    await Gameweek.updateMany({}, { isActive: false });

    // Activate the selected gameweek
    const gameweek = await Gameweek.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).populate("matches");

    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    res.json({ message: "Gameweek activated successfully", gameweek });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ✅ Remove match from gameweek (Admin only)
// ===============================
router.delete("/:gameweekId/matches/:matchId", requireAuth, async (req, res) => {
  try {
    const { gameweekId, matchId } = req.params;
    
    console.log("Delete match request:", { gameweekId, matchId });
    
    const gameweek = await Gameweek.findById(gameweekId);
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    console.log("Before removal - externalMatches:", gameweek.externalMatches);
    console.log("Looking for matchId:", matchId);
    console.log("Match IDs in array:", gameweek.externalMatches.map(m => m.toString()));

    // Remove the match from externalMatches array
    const originalLength = gameweek.externalMatches.length;
    gameweek.externalMatches = gameweek.externalMatches.filter(
      match => match.toString() !== matchId
    );
    
    console.log("After removal - externalMatches:", gameweek.externalMatches);
    console.log("Removed matches:", originalLength - gameweek.externalMatches.length);
    
    await gameweek.save();

    res.json({ message: "Match removed from gameweek successfully", gameweek });
  } catch (err) {
    console.error("Error in delete match:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Finish gameweek and calculate points (Admin only)
// ===============================
router.post("/:id/finish", requireAuth, async (req, res) => {
  try {
    const gameweek = await Gameweek.findById(req.params.id).populate("matches externalMatches");
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    console.log(`🏁 Finishing gameweek ${gameweek.number}...`);

    // 1. Sync all match data to fantasy teams first
    const matchDataService = require("../services/matchDataService");
    let syncedMatches = 0;
    
    for (const externalMatch of gameweek.externalMatches) {
      try {
        console.log(`🔄 Syncing match data for match: ${externalMatch.apiId}`);
        await matchDataService.syncMatchToFantasyTeams(externalMatch.apiId);
        syncedMatches++;
      } catch (error) {
        console.error(`❌ Error syncing match ${externalMatch.apiId}:`, error.message);
      }
    }

    // 2. Calculate fantasy points for all teams
    const { calculateGameweekPoints } = require("../services/fantasyScoringService");
    const scoringResults = await calculateGameweekPoints(gameweek._id);

    // 3. Mark gameweek as finished
    gameweek.isFinished = true;
    gameweek.isActive = false;
    gameweek.finishedAt = new Date();
    await gameweek.save();

    console.log(`✅ Gameweek ${gameweek.number} finished successfully`);
    console.log(`📊 Synced ${syncedMatches} matches and calculated points for ${scoringResults.length} teams`);

    res.json({ 
      message: "Gameweek finished successfully", 
      gameweek,
      stats: {
        syncedMatches,
        teamsScored: scoringResults.length,
        totalPoints: scoringResults.reduce((sum, team) => sum + team.totalPoints, 0)
      }
    });
  } catch (err) {
    console.error("❌ Error finishing gameweek:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
