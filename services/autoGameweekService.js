// services/autoGameweekService.js
const Gameweek = require("../models/Gameweek");
const ExternalMatch = require("../models/ExternalMatch");
const matchDataService = require("./matchDataService");
const { calculateGameweekPoints } = require("./fantasyScoringService");

// ✅ Auto Gameweek Management Service
class AutoGameweekService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
  }

  // ✅ Start monitoring gameweeks
  start() {
    if (this.isRunning) {
      console.log("⚠️ Auto gameweek service already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting auto gameweek service...");

    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkGameweekStatus();
    }, 1000 * 60 * 5); // 5 minutes

    // Run immediately
    this.checkGameweekStatus();
  }

  // ✅ Stop monitoring
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("🛑 Auto gameweek service stopped");
  }

  // ✅ Check current gameweek status
  async checkGameweekStatus() {
    try {
      console.log(`🔍 [${new Date().toISOString()}] Checking gameweek status...`);

      // Get active gameweek
      const activeGameweek = await Gameweek.findOne({ isActive: true })
        .populate("externalMatches");

      if (!activeGameweek) {
        console.log("⚠️ No active gameweek found");
        return;
      }

      console.log(`📅 Checking gameweek ${activeGameweek.number}...`);

      // Check if gameweek should end
      const now = new Date();
      const shouldEnd = now > activeGameweek.endDate;

      if (shouldEnd && !activeGameweek.isFinished) {
        console.log(`🏁 Gameweek ${activeGameweek.number} should end - processing...`);
        await this.finishGameweek(activeGameweek);
      } else {
        // Check for new match data and sync
        await this.syncActiveGameweekMatches(activeGameweek);
      }

    } catch (error) {
      console.error("❌ Error checking gameweek status:", error);
    }
  }

  // ✅ Sync matches for active gameweek
  async syncActiveGameweekMatches(gameweek) {
    try {
      console.log(`🔄 Syncing matches for active gameweek ${gameweek.number}...`);

      let syncedCount = 0;
      const results = [];

      for (const externalMatch of gameweek.externalMatches) {
        try {
          // Check if match is live or finished
          const matchDetails = await matchDataService.getMatchDetails(externalMatch.apiId);
          
          if (matchDetails && matchDetails.fixture.status.short === 'FT') {
            // Match is finished, sync the data
            console.log(`⚽ Match ${externalMatch.apiId} is finished - syncing data`);
            await matchDataService.syncMatchToFantasyTeams(externalMatch.apiId);
            syncedCount++;
            results.push({ matchId: externalMatch.apiId, status: 'synced' });
          } else if (matchDetails && matchDetails.fixture.status.short === 'LIVE') {
            // Match is live, sync current data
            console.log(`🔴 Match ${externalMatch.apiId} is live - syncing current data`);
            await matchDataService.syncMatchToFantasyTeams(externalMatch.apiId);
            syncedCount++;
            results.push({ matchId: externalMatch.apiId, status: 'live_synced' });
          }
        } catch (error) {
          console.error(`❌ Error syncing match ${externalMatch.apiId}:`, error.message);
          results.push({ matchId: externalMatch.apiId, status: 'error', error: error.message });
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ Synced ${syncedCount} matches for gameweek ${gameweek.number}`);
      }

      return results;
    } catch (error) {
      console.error("❌ Error syncing active gameweek matches:", error);
      return [];
    }
  }

  // ✅ Finish a gameweek
  async finishGameweek(gameweek) {
    try {
      console.log(`🏁 Finishing gameweek ${gameweek.number}...`);

      // 1. Sync all remaining match data
      let syncedMatches = 0;
      for (const externalMatch of gameweek.externalMatches) {
        try {
          await matchDataService.syncMatchToFantasyTeams(externalMatch.apiId);
          syncedMatches++;
        } catch (error) {
          console.error(`❌ Error syncing match ${externalMatch.apiId}:`, error.message);
        }
      }

      // 2. Calculate final points for all teams
      const scoringResults = await calculateGameweekPoints(gameweek._id);

      // 3. Mark gameweek as finished
      gameweek.isFinished = true;
      gameweek.isActive = false;
      gameweek.finishedAt = new Date();
      await gameweek.save();

      console.log(`✅ Gameweek ${gameweek.number} finished successfully`);
      console.log(`📊 Final stats: ${syncedMatches} matches synced, ${scoringResults.length} teams scored`);

      // 4. Check if we should create a new gameweek
      await this.checkForNewGameweek();

      return {
        gameweek: gameweek.number,
        syncedMatches,
        teamsScored: scoringResults.length,
        totalPoints: scoringResults.reduce((sum, team) => sum + team.totalPoints, 0)
      };
    } catch (error) {
      console.error("❌ Error finishing gameweek:", error);
      throw error;
    }
  }

  // ✅ Check if we need to create a new gameweek
  async checkForNewGameweek() {
    try {
      // Check if there's already an active gameweek
      const activeGameweek = await Gameweek.findOne({ isActive: true });
      if (activeGameweek) {
        console.log(`📅 Active gameweek ${activeGameweek.number} already exists`);
        return;
      }

      // Check if we should create a new gameweek
      const lastGameweek = await Gameweek.findOne().sort({ number: -1 });
      const now = new Date();
      
      // Create new gameweek if it's been more than 1 day since last gameweek ended
      if (lastGameweek && lastGameweek.finishedAt) {
        const daysSinceLastGameweek = (now - lastGameweek.finishedAt) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastGameweek >= 1) {
          console.log(`📅 Creating new gameweek...`);
          await this.createNewGameweek();
        }
      } else if (!lastGameweek) {
        // No gameweeks exist, create the first one
        console.log(`📅 Creating first gameweek...`);
        await this.createNewGameweek();
      }
    } catch (error) {
      console.error("❌ Error checking for new gameweek:", error);
    }
  }

  // ✅ Create a new gameweek
  async createNewGameweek() {
    try {
      // Get the next gameweek number
      const lastGameweek = await Gameweek.findOne().sort({ number: -1 });
      const nextNumber = lastGameweek ? lastGameweek.number + 1 : 1;

      // Calculate dates (7 days from now)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);

      const newGameweek = await Gameweek.create({
        number: nextNumber,
        name: `Gameweek ${nextNumber}`,
        description: `Fantasy gameweek ${nextNumber}`,
        startDate,
        endDate,
        isActive: true,
        matches: [],
        externalMatches: []
      });

      console.log(`✅ Created new gameweek ${nextNumber} (${startDate.toDateString()} - ${endDate.toDateString()})`);

      // Try to fetch and add some live matches
      await this.addLiveMatchesToGameweek(newGameweek);

      return newGameweek;
    } catch (error) {
      console.error("❌ Error creating new gameweek:", error);
      throw error;
    }
  }

  // ✅ Add live matches to new gameweek
  async addLiveMatchesToGameweek(gameweek) {
    try {
      console.log(`🔍 Looking for live matches to add to gameweek ${gameweek.number}...`);

      // Get live matches
      const liveMatches = await matchDataService.getLiveMatches();
      
      if (liveMatches.length === 0) {
        console.log("⚠️ No live matches found");
        return;
      }

      // Add first few live matches to the gameweek
      const matchesToAdd = liveMatches.slice(0, 3); // Add up to 3 matches
      const matchIds = matchesToAdd.map(match => match.fixture.id);

      console.log(`➕ Adding ${matchIds.length} live matches to gameweek ${gameweek.number}...`);

      // Use the existing add matches endpoint logic
      const externalMatches = [];
      
      for (const matchId of matchIds) {
        try {
          const matchDetails = await matchDataService.getMatchDetails(matchId);
          
          if (matchDetails) {
            const externalMatch = await ExternalMatch.create({
              apiId: matchId,
              fixture: matchDetails.fixture,
              league: matchDetails.league,
              teams: matchDetails.teams,
              goals: matchDetails.goals,
              score: matchDetails.score,
              matchType: "Regular Match",
              season: matchDetails.league?.season || new Date().getFullYear(),
              leagueId: matchDetails.league?.id
            });
            
            externalMatches.push(externalMatch._id);
          }
        } catch (error) {
          console.error(`❌ Error adding match ${matchId}:`, error.message);
        }
      }

      // Update gameweek with external matches
      gameweek.externalMatches = externalMatches;
      await gameweek.save();

      console.log(`✅ Added ${externalMatches.length} matches to gameweek ${gameweek.number}`);

    } catch (error) {
      console.error("❌ Error adding live matches to gameweek:", error);
    }
  }

  // ✅ Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const autoGameweekService = new AutoGameweekService();

module.exports = autoGameweekService;
