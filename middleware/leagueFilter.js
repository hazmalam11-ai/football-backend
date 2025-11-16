// League filtering middleware
// This middleware filters matches to only show allowed leagues

const { getAllowedLeagueIds, isLeagueAllowed } = require('../config/leagues');

/**
 * Filter matches array to only include allowed leagues
 * @param {Array} matches - Array of match objects
 * @returns {Array} Filtered matches array
 */
const filterMatchesByAllowedLeagues = (matches) => {
  if (!Array.isArray(matches)) {
    return [];
  }

  const allowedLeagueIds = getAllowedLeagueIds();
  
  return matches.filter(match => {
    // Check if match has tournament/league information
    if (!match.tournament || !match.tournament.id) {
      return false;
    }

    // Check if the league ID is in our allowed list
    return isLeagueAllowed(match.tournament.id);
  });
};

/**
 * Middleware function to filter matches by allowed leagues
 * This can be used as Express middleware or called directly
 */
const leagueFilterMiddleware = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override json method to filter matches
  res.json = function(data) {
    // Only filter if data is an array of matches
    if (Array.isArray(data) && data.length > 0 && data[0].tournament) {
      const filteredData = filterMatchesByAllowedLeagues(data);
      console.log(`🔍 League Filter: ${data.length} → ${filteredData.length} matches`);
      return originalJson.call(this, filteredData);
    }
    
    return originalJson.call(this, data);
  };
  
  if (next) next();
};

/**
 * Direct filtering function for use in route handlers
 * @param {Array} matches - Array of match objects
 * @returns {Array} Filtered matches array
 */
const filterMatches = (matches) => {
  return filterMatchesByAllowedLeagues(matches);
};

module.exports = {
  leagueFilterMiddleware,
  filterMatches,
  filterMatchesByAllowedLeagues
};
