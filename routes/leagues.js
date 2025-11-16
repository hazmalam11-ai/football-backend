// routes/leagues.js
const express = require("express");
const router = express.Router();
const { requireAuth, authorize } = require("../middlewares/auth");
const { getAllowedLeagues, getAllowedLeagueIds, updateAllowedLeagues, reloadConfiguration, getConfigInfo } = require("../config/leagues");

// Get all available tournaments from default configuration
router.get("/tournaments", requireAuth, authorize("admin"), async (req, res) => {
  try {
    // Get all default leagues from the configuration
    const { DEFAULT_ALLOWED_LEAGUES } = require("../config/leagues");
    const allDefaultLeagues = Object.values(DEFAULT_ALLOWED_LEAGUES);
    
    // Format them as tournaments for the frontend
    const tournaments = allDefaultLeagues.map(league => ({
      _id: `league_${league.id}`,
      apiId: league.id,
      name: league.name,
      country: league.country,
      type: "League",
      season: new Date().getFullYear(),
      logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
      priority: league.priority
    }));
    
    console.log(`📊 Found ${tournaments.length} available leagues from default configuration`);
    res.json(tournaments);
  } catch (error) {
    console.error("❌ Error fetching tournaments:", error);
    res.status(500).json({ message: "Error fetching tournaments", error: error.message });
  }
});

// Test endpoint to verify configuration (no auth required)
router.get("/test", (req, res) => {
  try {
    const allowedIds = getAllowedLeagueIds();
    const allowedLeagues = getAllowedLeagues();
    const configInfo = getConfigInfo();
    
    res.json({
      message: "Configuration test",
      allowedIds: allowedIds,
      allowedLeagues: allowedLeagues,
      count: allowedIds.length,
      configInfo: configInfo
    });
  } catch (error) {
    res.status(500).json({ message: "Error", error: error.message });
  }
});

// Get JSON configuration info
router.get("/config-info", requireAuth, authorize("admin"), (req, res) => {
  try {
    const configInfo = getConfigInfo();
    res.json({
      success: true,
      configInfo: configInfo
    });
  } catch (error) {
    res.status(500).json({ message: "Error getting config info", error: error.message });
  }
});

// Reload configuration from JSON
router.post("/reload", requireAuth, authorize("admin"), (req, res) => {
  try {
    const success = reloadConfiguration();
    res.json({
      success: success,
      message: success ? "Configuration reloaded successfully" : "Failed to reload configuration"
    });
  } catch (error) {
    res.status(500).json({ message: "Error reloading configuration", error: error.message });
  }
});

// Refresh league information from database
router.post("/refresh-info", requireAuth, authorize("admin"), async (req, res) => {
  try {
    const { getAllowedLeagueIds } = require("../config/leagues");
    const allowedIds = getAllowedLeagueIds();
    
    // Fetch current league information from database
    const Tournament = require("../models/tournament");
    const dbLeagues = await Tournament.find({ apiId: { $in: allowedIds } }).select('apiId name country logo type');
    
    // Update the configuration with database information
    const fs = require('fs');
    const path = require('path');
    const CONFIG_FILE = path.join(__dirname, '../config/leagues-config.json');
    
    const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const updatedLeagues = {};
    
    allowedIds.forEach((leagueId, index) => {
      const dbLeague = dbLeagues.find(league => league.apiId === leagueId);
      const existingLeague = configData.allowedLeagues[`league_${leagueId}`];
      
      if (dbLeague) {
        // Update with database information
        updatedLeagues[`league_${leagueId}`] = {
          id: leagueId,
          name: dbLeague.name || existingLeague?.name || `League ${leagueId}`,
          country: dbLeague.country || existingLeague?.country || 'Unknown',
          priority: existingLeague?.priority || (index + 1)
        };
      } else if (existingLeague) {
        // Keep existing information if not in database
        updatedLeagues[`league_${leagueId}`] = existingLeague;
      }
    });
    
    // Save updated configuration
    const newConfigData = {
      ...configData,
      allowedLeagues: updatedLeagues,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfigData, null, 2));
    
    console.log(`✅ Refreshed league information for ${Object.keys(updatedLeagues).length} leagues`);
    
    res.json({
      success: true,
      message: "League information refreshed from database",
      updatedCount: Object.keys(updatedLeagues).length
    });
  } catch (error) {
    console.error("❌ Error refreshing league information:", error);
    res.status(500).json({ message: "Error refreshing league information", error: error.message });
  }
});

// Get current allowed leagues configuration
router.get("/allowed", requireAuth, authorize("admin"), async (req, res) => {
  try {
    const allowedLeagues = getAllowedLeagues();
    const allowedIds = getAllowedLeagueIds();
    
    console.log(`🔍 Current allowed leagues: ${allowedIds.length} leagues`);
    res.json({
      allowedLeagues,
      allowedIds,
      count: allowedIds.length
    });
  } catch (error) {
    console.error("❌ Error fetching allowed leagues:", error);
    res.status(500).json({ message: "Error fetching allowed leagues", error: error.message });
  }
});

// Update allowed leagues configuration
router.put("/allowed", requireAuth, authorize("admin"), async (req, res) => {
  try {
    const { allowedLeagueIds, priorities } = req.body;
    
    if (!Array.isArray(allowedLeagueIds)) {
      return res.status(400).json({ message: "allowedLeagueIds must be an array" });
    }
    
    // Validate that all IDs are numbers
    const validIds = allowedLeagueIds.filter(id => typeof id === 'number' && id > 0);
    
    if (validIds.length !== allowedLeagueIds.length) {
      return res.status(400).json({ message: "All league IDs must be positive numbers" });
    }
    
    // If priorities are provided, handle them first
    if (priorities && typeof priorities === 'object') {
      console.log('🔍 Received priorities:', priorities);
      try {
        const { DEFAULT_ALLOWED_LEAGUES } = require("../config/leagues");
        
        // Create new configuration with updated priorities
        const newAllowedLeagues = {};
        
        // Fetch league information from database for unknown leagues
        const Tournament = require("../models/tournament");
        const dbLeagues = await Tournament.find({ apiId: { $in: validIds } }).select('apiId name country logo type');
        
        validIds.forEach((leagueId) => {
          const existingLeague = Object.values(DEFAULT_ALLOWED_LEAGUES).find(league => league.id === leagueId);
          const dbLeague = dbLeagues.find(league => league.apiId === leagueId);
          
          if (existingLeague) {
            // Use default configuration if available
            newAllowedLeagues[`league_${leagueId}`] = {
              ...existingLeague,
              priority: priorities[leagueId] || 1
            };
          } else if (dbLeague) {
            // Use database information for unknown leagues
            newAllowedLeagues[`league_${leagueId}`] = {
              id: leagueId,
              name: dbLeague.name || `League ${leagueId}`,
              country: dbLeague.country || 'Unknown',
              priority: priorities[leagueId] || 1
            };
          } else {
            // Fallback for completely unknown leagues
            newAllowedLeagues[`league_${leagueId}`] = {
              id: leagueId,
              name: `League ${leagueId}`,
              country: 'Unknown',
              priority: priorities[leagueId] || 1
            };
          }
        });
        
        // Update the configuration file
        const fs = require('fs');
        const path = require('path');
        const CONFIG_FILE = path.join(__dirname, '../config/leagues-config.json');
        
        const configData = {
          allowedLeagues: newAllowedLeagues,
          lastUpdated: new Date().toISOString(),
          version: "1.0",
          allowedIds: validIds,
          count: validIds.length
        };
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
        console.log(`✅ Updated priorities for ${Object.keys(priorities).length} leagues`);
        
        // Reload the configuration to update in-memory data
        const { reloadConfiguration } = require("../config/leagues");
        reloadConfiguration();
      } catch (priorityError) {
        console.error("⚠️ Error updating priorities:", priorityError);
        // Fall back to regular update
        const result = await updateAllowedLeagues(validIds);
      }
    } else {
      // No priorities provided, use regular update
      const result = await updateAllowedLeagues(validIds);
    }
    
    console.log(`✅ Updated allowed leagues: ${validIds.length} leagues`);
    console.log(`📋 New allowed league IDs: [${validIds.join(', ')}]`);
    
    res.json({
      message: "Allowed leagues updated successfully",
      allowedIds: validIds,
      count: validIds.length
    });
  } catch (error) {
    console.error("❌ Error updating allowed leagues:", error);
    res.status(500).json({ message: "Error updating allowed leagues", error: error.message });
  }
});

// Get leagues with their current status (allowed/not allowed)
router.get("/status", requireAuth, authorize("admin"), async (req, res) => {
  try {
    const allowedIds = getAllowedLeagueIds();
    const allowedLeagues = getAllowedLeagues();
    
    // Create a simple response with just the allowed leagues
    const tournamentsWithStatus = allowedLeagues.map(league => ({
      _id: `league_${league.id}`,
      apiId: league.id,
      name: league.name,
      country: league.country,
      type: "League",
      season: new Date().getFullYear(),
      logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
      isAllowed: true,
      priority: league.priority
    }));
    
    console.log(`📊 Found ${tournamentsWithStatus.length} allowed leagues`);
    res.json({
      tournaments: tournamentsWithStatus,
      allowedIds: allowedIds,
      allowedCount: allowedIds.length,
      totalCount: tournamentsWithStatus.length
    });
  } catch (error) {
    console.error("❌ Error fetching leagues status:", error);
    res.status(500).json({ message: "Error fetching leagues status", error: error.message });
  }
});

// Get priority order for frontend (no auth required for public use)
router.get("/priority", (req, res) => {
  try {
    const allowedLeagues = getAllowedLeagues();
    
    // Create priority order array based on configuration
    const priorityOrder = allowedLeagues
      .sort((a, b) => a.priority - b.priority) // Sort by priority
      .map(league => league.id); // Extract just the IDs
    
    console.log(`📋 Priority order: [${priorityOrder.join(', ')}]`);
    
    res.json({
      priorityOrder: priorityOrder,
      leagues: allowedLeagues.map(league => ({
        id: league.id,
        name: league.name,
        country: league.country,
        priority: league.priority
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching priority order:", error);
    res.status(500).json({ message: "Error fetching priority order", error: error.message });
  }
});

// Simple endpoint to update priorities only
router.put("/priorities", requireAuth, authorize("admin"), async (req, res) => {
  try {
    const { priorities } = req.body;
    
    
    if (!priorities || typeof priorities !== 'object') {
      return res.status(400).json({ message: "Priorities object is required" });
    }
    
    // Load current configuration
    const fs = require('fs');
    const path = require('path');
    const CONFIG_FILE = path.join(__dirname, '../config/leagues-config.json');
    
    let configData;
    try {
      const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
      configData = JSON.parse(configContent);
    } catch (error) {
      return res.status(500).json({ message: "Error loading configuration file" });
    }
    
    // Update priorities in the configuration
    Object.keys(configData.allowedLeagues).forEach(leagueKey => {
      const league = configData.allowedLeagues[leagueKey];
      if (priorities[league.id] !== undefined) {
        league.priority = priorities[league.id];
      }
    });
    
    // Update last modified timestamp
    configData.lastUpdated = new Date().toISOString();
    
    // Save updated configuration
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
    
    // Reload the in-memory configuration
    const { reloadConfiguration } = require("../config/leagues");
    reloadConfiguration();
    
    
    res.json({
      success: true,
      message: "Priorities updated successfully",
      updatedCount: Object.keys(priorities).length
    });
  } catch (error) {
    console.error("❌ Error updating priorities:", error);
    res.status(500).json({ message: "Error updating priorities", error: error.message });
  }
});

module.exports = router;
