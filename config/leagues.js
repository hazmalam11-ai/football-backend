// League filtering configuration
// This file defines which leagues/tournaments are allowed to be displayed

const fs = require('fs');
const path = require('path');

// Default allowed leagues configuration
const DEFAULT_ALLOWED_LEAGUES = {
  // TESTING: Only La Liga allowed
  la_liga: {
    id: 140,
    name: "La Liga",
    country: "Spain", 
    priority: 1
  },
  
  // All major leagues available for selection
  premier_league: {
    id: 39,
    name: "Premier League",
    country: "England",
    priority: 2
  },
  serie_a: {
    id: 135,
    name: "Serie A",
    country: "Italy",
    priority: 3
  },
  bundesliga: {
    id: 78,
    name: "Bundesliga",
    country: "Germany",
    priority: 4
  },
  ligue_1: {
    id: 61,
    name: "Ligue 1",
    country: "France",
    priority: 5
  },
  
  // European Competitions
  champions_league: {
    id: 2,
    name: "Champions League",
    country: "Europe",
    priority: 6
  },
  europa_league: {
    id: 3,
    name: "Europa League", 
    country: "Europe",
    priority: 7
  },
  
  // Other Major Leagues
  eredivisie: {
    id: 88,
    name: "Eredivisie",
    country: "Netherlands",
    priority: 8
  },
  primeira_liga: {
    id: 94,
    name: "Primeira Liga",
    country: "Portugal",
    priority: 9
  },
  belgian_pro_league: {
    id: 144,
    name: "Belgian Pro League",
    country: "Belgium",
    priority: 10
  }
};

// Configuration file path
const CONFIG_FILE = path.join(__dirname, 'leagues-config.json');

// Load configuration from JSON file or use default
let ALLOWED_LEAGUES = DEFAULT_ALLOWED_LEAGUES;

try {
  if (fs.existsSync(CONFIG_FILE)) {
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configData);
    ALLOWED_LEAGUES = config.allowedLeagues || DEFAULT_ALLOWED_LEAGUES;
    console.log('📁 Loaded leagues configuration from JSON file');
  } else {
    // Create initial JSON file with default configuration
    const initialConfig = {
      allowedLeagues: DEFAULT_ALLOWED_LEAGUES,
      lastUpdated: new Date().toISOString(),
      version: "1.0"
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2));
    console.log('📁 Created initial JSON configuration file');
  }
} catch (error) {
  console.error('❌ Error loading leagues configuration:', error);
  console.log('📁 Using default leagues configuration');
}

// Get allowed league IDs for filtering
const getAllowedLeagueIds = () => {
  return Object.values(ALLOWED_LEAGUES).map(league => league.id);
};

// Get allowed leagues with priority sorting
const getAllowedLeagues = () => {
  return Object.values(ALLOWED_LEAGUES).sort((a, b) => a.priority - b.priority);
};

// Check if a league ID is allowed
const isLeagueAllowed = (leagueId) => {
  return getAllowedLeagueIds().includes(leagueId);
};

// Get league info by ID
const getLeagueInfo = (leagueId) => {
  return Object.values(ALLOWED_LEAGUES).find(league => league.id === leagueId);
};

// Update allowed leagues configuration
const updateAllowedLeagues = async (allowedLeagueIds) => {
  try {
    // Create new configuration with only the allowed leagues
    const newAllowedLeagues = {};
    let priority = 1;
    
    // Fetch league information from database for unknown leagues
    let dbLeagues = [];
    try {
      const Tournament = require("../models/tournament");
      dbLeagues = await Tournament.find({ apiId: { $in: allowedLeagueIds } }).select('apiId name country logo type');
    } catch (dbError) {
      console.log('⚠️ Could not fetch from database, using fallback');
    }
    
    for (const leagueId of allowedLeagueIds) {
      // Find the league info from default configuration
      const existingLeague = Object.values(DEFAULT_ALLOWED_LEAGUES).find(league => league.id === leagueId);
      // Find the league info from database
      const dbLeague = dbLeagues.find(league => league.apiId === leagueId);
      
      if (existingLeague) {
        // Use default configuration if available
        newAllowedLeagues[`league_${leagueId}`] = {
          ...existingLeague,
          priority: priority++
        };
      } else if (dbLeague) {
        // Use database information for unknown leagues
        newAllowedLeagues[`league_${leagueId}`] = {
          id: leagueId,
          name: dbLeague.name || `League ${leagueId}`,
          country: dbLeague.country || 'Unknown',
          priority: priority++
        };
      } else {
        // Fallback for completely unknown leagues
        newAllowedLeagues[`league_${leagueId}`] = {
          id: leagueId,
          name: `League ${leagueId}`,
          country: "Unknown",
          priority: priority++
        };
      }
    }
    
    // Update the in-memory configuration
    ALLOWED_LEAGUES = newAllowedLeagues;
    
    // Save to JSON file with better structure
    const configData = {
      allowedLeagues: newAllowedLeagues,
      lastUpdated: new Date().toISOString(),
      version: "1.0",
      allowedIds: allowedLeagueIds,
      count: allowedLeagueIds.length
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
    
    console.log(`✅ Updated allowed leagues JSON configuration: ${allowedLeagueIds.length} leagues`);
    console.log(`📋 Allowed league IDs: [${allowedLeagueIds.join(', ')}]`);
    console.log(`💾 Saved to: ${CONFIG_FILE}`);
    
    return {
      success: true,
      allowedIds: allowedLeagueIds,
      count: allowedLeagueIds.length
    };
  } catch (error) {
    console.error('❌ Error updating allowed leagues:', error);
    throw error;
  }
};

// Reload configuration from JSON file
const reloadConfiguration = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      ALLOWED_LEAGUES = config.allowedLeagues || DEFAULT_ALLOWED_LEAGUES;
      console.log('🔄 Reloaded leagues configuration from JSON file');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error reloading configuration:', error);
    return false;
  }
};

// Get configuration file info
const getConfigInfo = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const stats = fs.statSync(CONFIG_FILE);
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      return {
        filePath: CONFIG_FILE,
        lastModified: stats.mtime,
        size: stats.size,
        version: config.version || '1.0',
        lastUpdated: config.lastUpdated,
        count: Object.keys(config.allowedLeagues || {}).length
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting config info:', error);
    return null;
  }
};

module.exports = {
  ALLOWED_LEAGUES,
  getAllowedLeagueIds,
  getAllowedLeagues,
  isLeagueAllowed,
  getLeagueInfo,
  updateAllowedLeagues,
  reloadConfiguration,
  getConfigInfo
};
