const express = require("express");
const router = express.Router();
const FantasyPoints = require("../models/FantasyPoints");
const FantasyTeam = require("../models/FantasyTeam");
const { getPlayerPerformanceStats } = require("../services/fantasyScoringService");
const Gameweek = require("../models/Gameweek");
const { requireAuth } = require("../middlewares/auth");

// ✅ Add player points
router.post("/", requireAuth, async (req, res) => {
  try {
    const points = await FantasyPoints.create(req.body);
    res.status(201).json({ message: "Points added successfully", points });
  } catch (err) {
    res.status(500).json({ error: "Failed to add points", details: err.message });
  }
});

// ✅ Get player points history
router.get("/player/:id", async (req, res) => {
  try {
    const { gameweekId } = req.query;
    const stats = await getPlayerPerformanceStats(req.params.id, gameweekId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch player points", details: err.message });
  }
});

// ✅ Get team points for a gameweek
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
    }).populate("player", "name position team");

    const totalPoints = playerPoints.reduce((sum, p) => sum + p.totalPoints, 0);

    res.json({
      teamId,
      gameweekId,
      totalPoints,
      playerPoints: playerPoints.map(pp => ({
        playerId: pp.player._id,
        playerName: pp.player.name,
        position: pp.player.position,
        team: pp.player.team,
        minutesPlayed: pp.minutesPlayed,
        goals: pp.goals,
        assists: pp.assists,
        cleanSheet: pp.cleanSheet,
        goalsConceded: pp.goalsConceded,
        yellowCards: pp.yellowCards,
        redCards: pp.redCards,
        penaltiesSaved: pp.penaltiesSaved,
        penaltiesMissed: pp.penaltiesMissed,
        totalPoints: pp.totalPoints
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch team points", details: err.message });
  }
});

// ✅ Get top performers for a gameweek
router.get("/gameweek/:gameweekId/top-performers", async (req, res) => {
  try {
    const { gameweekId } = req.params;
    const { limit = 10, position } = req.query;

    const query = { gameweek: gameweekId };
    if (position) {
      query['player.position'] = position;
    }

    const topPerformers = await FantasyPoints.find(query)
      .populate("player", "name position team")
      .sort({ totalPoints: -1 })
      .limit(parseInt(limit));

    res.json({
      gameweekId,
      topPerformers: topPerformers.map(tp => ({
        playerId: tp.player._id,
        playerName: tp.player.name,
        position: tp.player.position,
        team: tp.player.team,
        totalPoints: tp.totalPoints,
        goals: tp.goals,
        assists: tp.assists,
        cleanSheet: tp.cleanSheet
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch top performers", details: err.message });
  }
});

// ✅ Get player points breakdown
router.get("/player/:playerId/breakdown/:gameweekId", async (req, res) => {
  try {
    const { playerId, gameweekId } = req.params;
    
    const points = await FantasyPoints.findOne({
      player: playerId,
      gameweek: gameweekId
    }).populate("player", "name position team");

    if (!points) {
      return res.status(404).json({ error: "Player points not found for this gameweek" });
    }

    // Calculate breakdown
    const breakdown = {
      minutesPoints: Math.floor((points.minutesPlayed || 0) / 15),
      goalPoints: (points.goals || 0) * (points.player.position === 'Goalkeeper' ? 6 : 
                                        points.player.position === 'Defender' ? 6 :
                                        points.player.position === 'Midfielder' ? 5 : 4),
      assistPoints: (points.assists || 0) * 3,
      cleanSheetPoints: points.cleanSheet ? (points.player.position === 'Goalkeeper' ? 4 :
                                            points.player.position === 'Defender' ? 4 :
                                            points.player.position === 'Midfielder' ? 1 : 0) : 0,
      goalsConcededPoints: (points.player.position === 'Goalkeeper' || points.player.position === 'Defender') ? 
                          Math.floor((points.goalsConceded || 0) / 2) * -1 : 0,
      yellowCardPoints: (points.yellowCards || 0) * -1,
      redCardPoints: (points.redCards || 0) * -3,
      penaltySavedPoints: points.player.position === 'Goalkeeper' ? (points.penaltiesSaved || 0) * 5 : 0,
      penaltyMissedPoints: (points.penaltiesMissed || 0) * -2
    };

    res.json({
      player: {
        id: points.player._id,
        name: points.player.name,
        position: points.player.position,
        team: points.player.team
      },
      gameweek: gameweekId,
      totalPoints: points.totalPoints,
      breakdown
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch player breakdown", details: err.message });
  }
});

module.exports = router;

// ✅ Get latest points for authenticated user's starters (current or specified gameweek)
router.get("/my/latest", requireAuth, async (req, res) => {
  try {
    const { gameweek = "current" } = req.query;

    const team = await FantasyTeam.findOne({ user: req.user.id })
      .populate("players.player")
      .populate("currentGameweek");

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Determine target gameweek id
    let targetGameweekId = null;
    if (gameweek && gameweek !== "current") {
      targetGameweekId = gameweek; // explicit id provided
    } else if (team.currentGameweek) {
      targetGameweekId = team.currentGameweek._id;
    } else {
      const active = await Gameweek.findOne({ status: "active" }).sort({ number: -1 });
      targetGameweekId = active?._id || team.pointsHistory?.[team.pointsHistory.length - 1]?.gameweek;
    }

    if (!targetGameweekId) {
      return res.json({ message: "No gameweek found", teamId: team._id, totalPoints: 0, playerPoints: [] });
    }

    // Only starters
    const startersSet = new Set((team.tacticalSetup?.starters || []).map(id => id.toString()));
    const starterPlayers = team.players.filter(p => p.player && startersSet.has(p.player._id.toString()));
    const starterIds = starterPlayers.map(p => p.player._id);

    const pointsDocs = await FantasyPoints.find({
      player: { $in: starterIds },
      gameweek: targetGameweekId
    }).populate("player", "name position team");

    const playerPoints = pointsDocs.map(pp => ({
      playerId: pp.player._id,
      playerName: pp.player.name,
      position: pp.player.position,
      isCaptain: starterPlayers.find(sp => sp.player._id.toString() === pp.player._id.toString())?.isCaptain || false,
      isViceCaptain: starterPlayers.find(sp => sp.player._id.toString() === pp.player._id.toString())?.isViceCaptain || false,
      minutesPlayed: pp.minutesPlayed || 0,
      goals: pp.goals || 0,
      assists: pp.assists || 0,
      cleanSheet: pp.cleanSheet || false,
      goalsConceded: pp.goalsConceded || 0,
      yellowCards: pp.yellowCards || 0,
      redCards: pp.redCards || 0,
      penaltiesSaved: pp.penaltiesSaved || 0,
      penaltiesMissed: pp.penaltiesMissed || 0,
      totalPoints: pp.totalPoints || 0
    }));

    const totalPoints = playerPoints.reduce((sum, p) => sum + (p.totalPoints || 0), 0);

    res.json({
      message: "✅ Latest points",
      teamId: team._id,
      gameweekId: targetGameweekId,
      totalPoints,
      playerPoints
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch latest points", details: err.message });
  }
});