// routes/fantasyScoring.js
const express = require("express");
const FantasyTeam = require("../models/FantasyTeam");
const FantasyPoints = require("../models/FantasyPoints");
const Player = require("../models/Player");
const Gameweek = require("../models/Gameweek");
const { requireAuth } = require("../middlewares/auth");
const router = express.Router();

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

// ✅ Calculate team points for a gameweek
router.post("/calculate/:teamId", requireAuth, async (req, res) => {
  try {
    const { gameweekId } = req.body;
    
    if (!gameweekId) {
      return res.status(400).json({ error: "Gameweek ID is required" });
    }

    const team = await FantasyTeam.findById(req.params.teamId)
      .populate("players.player")
      .populate("players.match");

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    const gameweek = await Gameweek.findById(gameweekId)
      .populate('externalMatches');
    if (!gameweek) {
      return res.status(404).json({ error: "Gameweek not found" });
    }

    // Check if gameweek is active and has matches
    if (!gameweek.isActive) {
      return res.status(400).json({ 
        error: "Gameweek is not active", 
        message: "Points can only be calculated for active gameweeks" 
      });
    }

    // Check if there are any matches in this gameweek
    if (!gameweek.externalMatches || gameweek.externalMatches.length === 0) {
      return res.status(400).json({ 
        error: "No matches in this gameweek", 
        message: "Cannot calculate points without matches" 
      });
    }

    let totalPoints = 0;
    const playerPoints = [];

    // Calculate points for each player (ONLY for starting XI, not substitutes)
    for (const playerData of team.players) {
      if (!playerData.player) continue;

      // ✅ SUBSTITUTES ALWAYS GET 0 POINTS - they don't earn points unless they're in starting XI
      console.log(`🔍 Player ${playerData.player.name}: isSubstitute = ${playerData.isSubstitute}`);
      if (playerData.isSubstitute) {
        console.log(`🟡 Substitute ${playerData.player.name}: giving 0 points (substitutes don't score)`);
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

      // Get player's match stats for this gameweek
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

    // Check if points for this gameweek have already been calculated
    const existingGameweekPoints = team.pointsHistory.find(
      ph => ph.gameweek.toString() === gameweekId.toString()
    );

    if (existingGameweekPoints) {
      // Points already calculated for this gameweek, don't add again
      console.log(`⚠️ Points already calculated for gameweek ${gameweekId}, returning existing total`);
      return res.json({ 
        message: "✅ Points already calculated for this gameweek", 
        teamId: team._id,
        gameweekId,
        totalPoints: existingGameweekPoints.points,
        playerPoints,
        teamTotalPoints: team.totalPoints,
        alreadyCalculated: true
      });
    }

    // Update team total points (only add once per gameweek)
    team.totalPoints = (team.totalPoints || 0) + totalPoints;
    
    // Add to points history to prevent duplicate calculations
    team.pointsHistory.push({
      gameweek: gameweekId,
      points: totalPoints
    });
    
    await team.save();

    res.json({ 
      message: "✅ Points calculated successfully", 
      teamId: team._id,
      gameweekId,
      totalPoints,
      playerPoints,
      teamTotalPoints: team.totalPoints
    });
  } catch (err) {
    console.error("Scoring calculation error:", err);
    res.status(500).json({ error: "❌ Error calculating points", details: err.message });
  }
});

// ✅ Get team points for a specific gameweek
router.get("/team/:teamId/gameweek/:gameweekId", async (req, res) => {
  try {
    const { teamId, gameweekId } = req.params;
    
    const team = await FantasyTeam.findById(teamId).populate("players.player");
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    const playerPoints = await FantasyPoints.find({
      player: { $in: team.players.map(p => p.player._id) },
      gameweek: gameweekId
    }).populate("player", "name position");

    const totalPoints = playerPoints.reduce((sum, p) => sum + p.totalPoints, 0);

    res.json({
      teamId,
      gameweekId,
      totalPoints,
      playerPoints
    });
  } catch (err) {
    res.status(500).json({ error: "❌ Error fetching team points", details: err.message });
  }
});

// ✅ Get player points history
router.get("/player/:playerId", async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const points = await FantasyPoints.find({ player: playerId })
      .populate("gameweek", "number name")
      .sort({ createdAt: -1 });

    res.json(points);
  } catch (err) {
    res.status(500).json({ error: "❌ Error fetching player points", details: err.message });
  }
});

// ✅ Get live points for a team (read-only, no calculation)
router.get("/live/:teamId", requireAuth, async (req, res) => {
  try {
    const { gameweekId } = req.query;
    
    if (!gameweekId) {
      return res.status(400).json({ error: "Gameweek ID is required" });
    }

    const team = await FantasyTeam.findById(req.params.teamId)
      .populate("players.player")
      .populate("currentGameweek");

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    let gameweek = await Gameweek.findById(gameweekId)
      .populate('externalMatches');
    
    // If gameweek not found, we'll handle it later when looking for points
    if (!gameweek) {
      console.log(`⚠️ Gameweek ${gameweekId} not found, will look for most recent gameweek with points`);
    }

    // Check if any matches in this gameweek are still live
    let isLive = false;
    let matchStatus = "finished";
    
    if (gameweek && gameweek.externalMatches && gameweek.externalMatches.length > 0) {
      // Check if any match is still live
      const liveMatches = gameweek.externalMatches.filter(match => {
        const status = match.fixture?.status?.short;
        return status === "LIVE" || status === "1H" || status === "2H" || status === "HT";
      });
      
      isLive = liveMatches.length > 0;
      
      if (isLive) {
        matchStatus = "live";
      } else {
        // Check if all matches are finished
        const finishedMatches = gameweek.externalMatches.filter(match => {
          const status = match.fixture?.status?.short;
          return status === "FT" || status === "AET" || status === "PEN";
        });
        
        if (finishedMatches.length === gameweek.externalMatches.length) {
          matchStatus = "finished";
        } else {
          matchStatus = "scheduled";
        }
      }
    }

    // Get points from the most recent gameweek that has calculated points
    let totalPoints = 0;
    let playerPoints = [];
    let actualGameweekId = gameweekId;
    let actualGameweek = gameweek;

    // First, try to get points for the requested gameweek
    let existingGameweekPoints = team.pointsHistory.find(
      ph => ph.gameweek.toString() === gameweekId.toString()
    );

    // If no points for requested gameweek, get the most recent gameweek with points
    if (!existingGameweekPoints && team.pointsHistory.length > 0) {
      // Sort pointsHistory by creation date (most recent first)
      const sortedPointsHistory = team.pointsHistory.sort((a, b) => new Date(b._id.getTimestamp()) - new Date(a._id.getTimestamp()));
      
      // Get the most recent gameweek with points
      const mostRecentPoints = sortedPointsHistory[0];
      actualGameweekId = mostRecentPoints.gameweek;
      
      // Fetch the actual gameweek details
      actualGameweek = await Gameweek.findById(actualGameweekId).populate('externalMatches');
      existingGameweekPoints = mostRecentPoints;
      
      // Update match status based on the actual gameweek
      if (actualGameweek && actualGameweek.externalMatches && actualGameweek.externalMatches.length > 0) {
        const liveMatches = actualGameweek.externalMatches.filter(match => {
          const status = match.fixture?.status?.short;
          return status === "LIVE" || status === "1H" || status === "2H" || status === "HT";
        });
        
        isLive = liveMatches.length > 0;
        
        if (isLive) {
          matchStatus = "live";
        } else {
          const finishedMatches = actualGameweek.externalMatches.filter(match => {
            const status = match.fixture?.status?.short;
            return status === "FT" || status === "AET" || status === "PEN";
          });
          
          if (finishedMatches.length === actualGameweek.externalMatches.length) {
            matchStatus = "finished";
          } else {
            matchStatus = "scheduled";
          }
        }
      }
      
      console.log(`📊 No points for gameweek ${gameweekId}, using most recent gameweek ${actualGameweekId} with ${mostRecentPoints.points} points`);
    }

    if (existingGameweekPoints) {
      // Points already calculated, get them from pointsHistory
      totalPoints = existingGameweekPoints.points;
      
      // Get player points from FantasyPoints collection for the actual gameweek
      const fantasyPoints = await FantasyPoints.find({
        player: { $in: team.players.map(p => p.player._id) },
        gameweek: actualGameweekId
      }).populate("player", "name position");

      playerPoints = fantasyPoints.map(pp => ({
        playerId: pp.player._id,
        playerName: pp.player.name,
        position: pp.player.position,
        basePoints: pp.totalPoints,
        finalPoints: pp.totalPoints,
        breakdown: {
          minutesPoints: pp.minutesPlayed ? Math.floor(pp.minutesPlayed / 15) : 0,
          goalPoints: (pp.goals || 0) * (SCORING_RULES.goals[pp.player.position] || 4),
          assistPoints: (pp.assists || 0) * SCORING_RULES.assists,
          cleanSheetPoints: pp.cleanSheet ? (SCORING_RULES.cleanSheets[pp.player.position] || 0) : 0,
          yellowCardPoints: (pp.yellowCards || 0) * SCORING_RULES.yellowCard,
          redCardPoints: (pp.redCards || 0) * SCORING_RULES.redCard,
          penaltyMissedPoints: (pp.penaltiesMissed || 0) * SCORING_RULES.penaltyMissed
        }
      }));
    } else {
      // No points calculated for any gameweek, return empty data
      totalPoints = 0;
      playerPoints = [];
    }

    // If all matches are finished and gameweek is still active, suggest finishing it
    if (matchStatus === "finished" && actualGameweek && actualGameweek.isActive && !actualGameweek.isFinished) {
      console.log(`🏁 All matches finished in gameweek ${actualGameweek.number}, should be marked as finished`);
    }

    res.json({
      message: isLive ? "Live points retrieved" : "Points retrieved",
      teamId: team._id,
      gameweekId: actualGameweekId, // Use actual gameweek ID that has points
      requestedGameweekId: gameweekId, // Original requested gameweek ID
      totalPoints,
      playerPoints,
      teamTotalPoints: team.totalPoints,
      isLive: isLive,
      matchStatus: matchStatus,
      gameweekActive: actualGameweek ? actualGameweek.isActive : false,
      gameweekNumber: actualGameweek ? actualGameweek.number : null,
      shouldFinishGameweek: matchStatus === "finished" && actualGameweek && actualGameweek.isActive && !actualGameweek.isFinished,
      pointsFromDifferentGameweek: actualGameweekId.toString() !== gameweekId.toString()
    });
  } catch (err) {
    console.error("Live points error:", err);
    res.status(500).json({ error: "❌ Error fetching live points", details: err.message });
  }
});

// ✅ Get scoring rules
router.get("/rules", (req, res) => {
  res.json({
    message: "Fantasy scoring rules",
    rules: SCORING_RULES
  });
});

module.exports = router;