// League filtering middleware (DISABLED)
// This version returns all matches without filtering

/**
 * Direct filtering function (disabled)
 */
const filterMatches = (matches) => {
  return matches; // No filtering at all
};

/**
 * Middleware function (disabled)
 */
const leagueFilterMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    return originalJson.call(this, data); // No filter
  };

  if (next) next();
};

module.exports = {
  leagueFilterMiddleware,
  filterMatches,
  filterMatchesByAllowedLeagues: (matches) => matches // also disabled
};
