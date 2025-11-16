// services/fantasyScoringService.js
const FantasyTeam = require("../models/FantasyTeam");
const FantasyPoints = require("../models/FantasyPoints");
const ExternalMatch = require("../models/ExternalMatch");
const Gameweek = require("../models/Gameweek");
const Player = require("../models/Player");

// ✅ Comprehensive Fantasy Scoring System
const SCORING_RULES = {
  // Goals by position
  goals: {
    'Goalkeeper': 6,
    'Defender': 6,
    'Midfielder': 5,
    'Forward': 4,
    'Attacker': 4
  },
  // Assists
  assists: 3,
  // Clean sheets
  cleanSheets: {
    'Goalkeeper': 4,
    'Defender': 4,
    'Midfielder': 1,
    'Forward': 0,
    'Attacker': 0
  },
  // Goals conceded (for goalkeepers and defenders)
  goalsConceded: {
    'Goalkeeper': -1, // per 2 goals conceded
    'Defender': -1    // per 2 goals conceded
  },
  // Cards
  yellowCard: -1,
  redCard: -3,
  // Penalties
  penaltySaved: 5,
  penaltyMissed: -2,
  // Minutes played
  minutesPlayed: 1, // per 15 minutes
  // Captain multipliers
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5
};

// ✅ Calculate points for a single player
const calculatePlayerPoints = (playerData, matchStats) => {
  const position = playerData.player?.position || 'Midfielder';
  let points = 0;
  const breakdown = {};

  // Minutes played points
  const minutes = matchStats.minutesPlayed || 0;
  const minutesPoints = Math.floor(minutes / 15) * SCORING_RULES.minutesPlayed;
  points += minutesPoints;
  breakdown.minutesPoints = minutesPoints;

  // Goals
  const goals = matchStats.goals || 0;
  const goalPoints = goals * (SCORING_RULES.goals[position] || 4);
  points += goalPoints;
  breakdown.goalPoints = goalPoints;

  // Assists
  const assists = matchStats.assists || 0;
  const assistPoints = assists * SCORING_RULES.assists;
  points += assistPoints;
  breakdown.assistPoints = assistPoints;

  // Clean sheet
  if (matchStats.cleanSheet) {
    const cleanSheetPoints = SCORING_RULES.cleanSheets[position] || 0;
    points += cleanSheetPoints;
    breakdown.cleanSheetPoints = cleanSheetPoints;
  }

  // Goals conceded (for goalkeepers and defenders)
  if (position === 'Goalkeeper' || position === 'Defender') {
    const goalsConceded = matchStats.goalsConceded || 0;
    const goalsConcededPoints = Math.floor(goalsConceded / 2) * SCORING_RULES.goalsConceded[position];
    points += goalsConcededPoints;
    breakdown.goalsConcededPoints = goalsConcededPoints;
  }

  // Yellow cards
  const yellowCards = matchStats.yellowCards || 0;
  const yellowCardPoints = yellowCards * SCORING_RULES.yellowCard;
  points += yellowCardPoints;
  breakdown.yellowCardPoints = yellowCardPoints;

  // Red cards
  const redCards = matchStats.redCards || 0;
  const redCardPoints = redCards * SCORING_RULES.redCard;
  points += redCardPoints;
  breakdown.redCardPoints = redCardPoints;

  // Penalties saved (goalkeepers only)
  if (position === 'Goalkeeper') {
    const penaltiesSaved = matchStats.penaltiesSaved || 0;
    const penaltySavedPoints = penaltiesSaved * SCORING_RULES.penaltySaved;
    points += penaltySavedPoints;
    breakdown.penaltySavedPoints = penaltySavedPoints;
  }

  // Penalties missed
  const penaltiesMissed = matchStats.penaltiesMissed || 0;
  const penaltyMissedPoints = penaltiesMissed * SCORING_RULES.penaltyMissed;
  points += penaltyMissedPoints;
  breakdown.penaltyMissedPoints = penaltyMissedPoints;

  // Apply captain/vice-captain multiplier
  let finalPoints = points;
  if (playerData.isCaptain) {
    finalPoints = points * SCORING_RULES.captainMultiplier;
    breakdown.captainMultiplier = SCORING_RULES.captainMultiplier;
  } else if (playerData.isViceCaptain) {
    finalPoints = points * SCORING_RULES.viceCaptainMultiplier;
    breakdown.viceCaptainMultiplier = SCORING_RULES.viceCaptainMultiplier;
  }

  return {
    basePoints: points,
    finalPoints: finalPoints,
    breakdown
  };
};

// ✅ Sync match data to fantasy teams
// Helper function to calculate clean sheet
const calculateCleanSheet = (stats, isHomePlayer) => {
  // For goalkeepers and defenders, clean sheet if team didn't concede
  if (stats.games?.position === 'G' || stats.games?.position === 'D') {
    return stats.goals?.conceded === 0;
  }
  return false;
};

// Helper function to calculate goals conceded
const calculateGoalsConceded = (stats, isHomePlayer) => {
  return stats.goals?.conceded || 0;
};

// Removed name-based fallback. We only use real stats and starters now.

const syncMatchDataToFantasyTeams = async (matchId) => {
  try {
    // Handle both ObjectId and API match ID
    let match;
    if (typeof matchId === 'string' && matchId.length === 24) {
      // It's an ObjectId
      match = await ExternalMatch.findById(matchId);
    } else {
      // It's an API match ID, find by apiId
      match = await ExternalMatch.findOne({ apiId: parseInt(matchId) });
    }
    
    if (!match) {
      throw new Error('Match not found');
    }

    // Get all fantasy teams
    const fantasyTeams = await FantasyTeam.find()
      .populate('players.player')
      .populate('currentGameweek');

    // Fetch match player stats once and build apiId -> stats map
    const matchDataService = require('./matchDataService');
    const rawStats = await matchDataService.getMatchPlayerStats(match.apiId);

    // Normalize API-Football fixtures/players payload
    const teamsEntries = Array.isArray(rawStats?.response)
      ? rawStats.response
      : (Array.isArray(rawStats) ? rawStats : []);

    if (!teamsEntries.length) {
      console.warn('⚠️ No player stats available for this match, nothing to sync.');
      return 0;
    }

    // Build a map of api player id -> stats
    const playerStatsByApiId = new Map();
    for (const entry of teamsEntries) {
      const isHome = entry.team?.id === match.teams.home.id;
      const players = entry.players || [];
      for (const pl of players) {
        const s = pl.statistics && pl.statistics[0] ? pl.statistics[0] : {};
        const unified = {
          playerId: pl.player?.id,
          minutesPlayed: s.games?.minutes || 0,
          goals: s.goals?.total || 0,
          assists: s.goals?.assists || 0,
          yellowCards: s.cards?.yellow || 0,
          redCards: s.cards?.red || 0,
          penaltiesSaved: s.penalty?.saved || 0,
          penaltiesMissed: s.penalty?.missed || 0,
          // Basic clean sheet/GC from goals.conceded if present
          cleanSheet: (s.games?.position === 'G' || s.games?.position === 'D') ? (s.goals?.conceded === 0) : false,
          goalsConceded: s.goals?.conceded || 0
        };
        if (unified.playerId) {
          playerStatsByApiId.set(unified.playerId, { stats: unified, isHome });
        }
      }
    }

    for (const team of fantasyTeams) {
      const startersSet = new Set((team.tacticalSetup?.starters || []).map(id => id.toString()));

      for (const playerData of team.players) {
        if (!playerData.player) continue;
        // Update ONLY starters; respect transfers/changes
        if (!startersSet.has(playerData.player._id.toString())) continue;

        const apiId = playerData.player.apiId;
        const entry = playerStatsByApiId.get(apiId);

        if (!entry) continue; // no stats for this player in this match

        const { stats } = entry;

        // Apply real stats
        playerData.minutesPlayed = stats.minutesPlayed || 0;
        playerData.goals = stats.goals || 0;
        playerData.assists = stats.assists || 0;
        playerData.cleanSheet = !!stats.cleanSheet;
        playerData.goalsConceded = stats.goalsConceded || 0;
        playerData.yellowCards = stats.yellowCards || 0;
        playerData.redCards = stats.redCards || 0;
        playerData.penaltiesSaved = stats.penaltiesSaved || 0;
        playerData.penaltiesMissed = stats.penaltiesMissed || 0;
        playerData.match = match._id;

        console.log(`✅ Updated ${playerData.player.name} (apiId=${apiId}) with real stats: ${playerData.goals}G ${playerData.assists}A ${playerData.minutesPlayed}min`);
      }

      await team.save();
    }

    console.log(`✅ Synced match data for ${fantasyTeams.length} fantasy teams`);
    return fantasyTeams.length;
  } catch (error) {
    console.error('❌ Error syncing match data:', error);
    throw error;
  }
};

// ✅ Calculate points for all teams in a gameweek
const calculateGameweekPoints = async (gameweekId) => {
  try {
    const gameweek = await Gameweek.findById(gameweekId);
    if (!gameweek) {
      throw new Error('Gameweek not found');
    }

    const fantasyTeams = await FantasyTeam.find()
      .populate('players.player')
      .populate('currentGameweek');

    const results = [];

    for (const team of fantasyTeams) {
      let totalPoints = 0;
      const playerPoints = [];

      // Calculate points for each player (ONLY for starting XI, not substitutes)
      for (const playerData of team.players) {
        if (!playerData.player) continue;

        // ✅ SUBSTITUTES ALWAYS GET 0 POINTS - they don't earn points unless they're in starting XI
        if (playerData.isSubstitute) {
          // Add substitute with 0 points to the response
          playerPoints.push({
            playerId: playerData.player._id,
            playerName: playerData.player.name,
            position: playerData.player.position,
            isCaptain: playerData.isCaptain,
            isViceCaptain: playerData.isViceCaptain,
            basePoints: 0,
            finalPoints: 0,
            breakdown: {
              minutesPoints: 0,
              goalPoints: 0,
              assistPoints: 0,
              yellowCardPoints: 0,
              redCardPoints: 0,
              penaltyMissedPoints: 0
            }
          });
          continue;
        }

        const matchStats = {
          minutesPlayed: playerData.minutesPlayed || 0,
          goals: playerData.goals || 0,
          assists: playerData.assists || 0,
          cleanSheet: playerData.cleanSheet || false,
          goalsConceded: playerData.goalsConceded || 0,
          yellowCards: playerData.yellowCards || 0,
          redCards: playerData.redCards || 0,
          penaltiesSaved: playerData.penaltiesSaved || 0,
          penaltiesMissed: playerData.penaltiesMissed || 0
        };

        const playerPointsData = calculatePlayerPoints(playerData, matchStats);
        totalPoints += playerPointsData.finalPoints;

        playerPoints.push({
          playerId: playerData.player._id,
          playerName: playerData.player.name,
          position: playerData.player.position,
          isCaptain: playerData.isCaptain,
          isViceCaptain: playerData.isViceCaptain,
          basePoints: playerPointsData.basePoints,
          finalPoints: playerPointsData.finalPoints,
          breakdown: playerPointsData.breakdown
        });

        // Save individual player points to database
        await FantasyPoints.findOneAndUpdate(
          { 
            player: playerData.player._id, 
            gameweek: gameweekId 
          },
          {
            player: playerData.player._id,
            gameweek: gameweekId,
            ...matchStats,
            totalPoints: playerPointsData.finalPoints
          },
          { upsert: true, new: true }
        );
      }

      // Update team total points
      team.totalPoints = (team.totalPoints || 0) + totalPoints;
      
      // Add to points history
      team.pointsHistory.push({
        gameweek: gameweekId,
        points: totalPoints
      });

      await team.save();

      results.push({
        teamId: team._id,
        teamName: team.name,
        totalPoints,
        playerPoints
      });
    }

    console.log(`✅ Calculated points for ${results.length} teams in gameweek ${gameweekId}`);
    return results;
  } catch (error) {
    console.error('❌ Error calculating gameweek points:', error);
    throw error;
  }
};

// ✅ Get team leaderboard for a gameweek
const getGameweekLeaderboard = async (gameweekId) => {
  try {
    const teams = await FantasyTeam.find()
      .populate('user', 'name email')
      .populate('pointsHistory.gameweek')
      .sort({ totalPoints: -1 });

    const leaderboard = teams.map((team, index) => {
      const gameweekPoints = team.pointsHistory.find(
        ph => ph.gameweek.toString() === gameweekId.toString()
      )?.points || 0;

      return {
        rank: index + 1,
        teamId: team._id,
        teamName: team.name,
        userName: team.user.name,
        totalPoints: team.totalPoints,
        gameweekPoints,
        teamType: team.teamType,
        formation: team.formation
      };
    });

    return leaderboard;
  } catch (error) {
    console.error('❌ Error getting leaderboard:', error);
    throw error;
  }
};

// ✅ Get player performance stats
const getPlayerPerformanceStats = async (playerId, gameweekId = null) => {
  try {
    const query = { player: playerId };
    if (gameweekId) {
      query.gameweek = gameweekId;
    }

    const points = await FantasyPoints.find(query)
      .populate('gameweek', 'number name')
      .populate('player', 'name position team')
      .sort({ createdAt: -1 });

    const totalPoints = points.reduce((sum, p) => sum + p.totalPoints, 0);
    const averagePoints = points.length > 0 ? totalPoints / points.length : 0;

    return {
      player: points[0]?.player,
      totalPoints,
      averagePoints,
      gameweeks: points.length,
      pointsHistory: points
    };
  } catch (error) {
    console.error('❌ Error getting player performance:', error);
    throw error;
  }
};

module.exports = {
  SCORING_RULES,
  calculatePlayerPoints,
  syncMatchDataToFantasyTeams,
  calculateGameweekPoints,
  getGameweekLeaderboard,
  getPlayerPerformanceStats
};
