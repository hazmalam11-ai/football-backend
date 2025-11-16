const express = require("express");
const router = express.Router();
const FantasyTeam = require("../models/FantasyTeam");
const Player = require("../models/Player");
const Team = require("../models/Team");
const { requireAuth } = require("../middlewares/auth");

// ✅ إنشاء فريق جديد (واحد فقط لكل مستخدم)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, players, teamType } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }

    // Check if user already has a team
    const existingTeam = await FantasyTeam.findOne({ user: req.user.id });
    if (existingTeam) {
      return res.status(400).json({ 
        message: "You already have a fantasy team. Only one team per user is allowed.",
        existingTeam: {
          _id: existingTeam._id,
          name: existingTeam.name,
          teamType: existingTeam.teamType
        }
      });
    }

    // Create team with or without players
    const teamData = {
      user: req.user.id,
      name,
      teamType: teamType || 'custom',
    };

    // If players are provided and valid, add them
    if (players && Array.isArray(players) && players.length > 0) {
      teamData.players = players;
    }

    const team = await FantasyTeam.create(teamData);

    res.status(201).json({ message: "Fantasy team created", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ جلب كل الفرق الخاصة باليوزر
router.get("/my", requireAuth, async (req, res) => {
  try {
    const teams = await FantasyTeam.find({ user: req.user.id }).populate("players.player");
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ تحديث فريق (تحويلات أو تعديل لاعبين)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    console.log('🔍 Updating team:', req.params.id);
    console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
    
    const updated = await FantasyTeam.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    ).populate("players.player");

    if (!updated) return res.status(404).json({ message: "Team not found" });

    console.log('✅ Team updated successfully:', updated);
    res.json({ message: "Team updated", team: updated });
  } catch (err) {
    console.error('❌ Error updating team:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ حفظ التشكيلة التكتيكية
router.put("/:id/tactics", requireAuth, async (req, res) => {
  try {
    const { formation, starters, substitutes } = req.body;

    const team = await FantasyTeam.findOne({ _id: req.params.id, user: req.user.id });
    if (!team) return res.status(404).json({ message: "Team not found" });

    // Update tactical information
    team.formation = formation;
    team.tacticalSetup = {
      starters: starters || [],
      substitutes: substitutes || [],
      lastUpdated: new Date()
    };

    await team.save();

    res.json({ message: "Tactical formation saved", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ حذف فريق
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await FantasyTeam.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!deleted) return res.status(404).json({ message: "Team not found" });

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ جلب اللاعبين للفريق المحدد
router.get("/players/:teamType", async (req, res) => {
  try {
    const { teamType } = req.params;
    
    // API IDs for Barcelona and Real Madrid
    const teamApiIds = {
      'barcelona': 529,
      'real-madrid': 541
    };

    const apiId = teamApiIds[teamType];
    if (!apiId) {
      return res.status(400).json({ message: "Invalid team type" });
    }

    // Always fetch team info from API-Football
    const { getTeamInfo, getTeamPlayers } = require("../services/footballAPI");
    
    let team;
    try {
      const teamData = await getTeamInfo(apiId);
      if (teamData?.team) {
        team = {
          _id: `api_${apiId}`, // Temporary ID for API response
          name: teamData.team.name,
          logo: teamData.team.logo,
          country: teamData.team.country || ''
        };
      } else {
        return res.status(404).json({ message: "Team not found in API-Football" });
      }
    } catch (e) {
      console.error('Failed to fetch team from API-Football:', e?.message || e);
      return res.status(500).json({ message: "Failed to fetch team from API" });
    }

    // Always fetch players from API-Football
    let players = [];
    try {
      const season = new Date().getFullYear();
      const apiPlayers = await getTeamPlayers(apiId, season);

      players = apiPlayers.map((item, index) => {
        const p = item.player || {};
        const s = (item.statistics && item.statistics[0]) || {};
        return {
          _id: `api_${p.id || index}`, // Temporary ID for API response
          apiId: p.id,
          name: p.name || 'Unknown Player',
          position: s?.games?.position || 'Unknown',
          nationality: p.nationality || '',
          age: p.age || null,
          photo: p.photo || '',
          price: Math.floor(Math.random() * 10) + 5, // Random price 5-15
          totalPoints: Math.floor(Math.random() * 100), // Random points
          stats: {}
        };
      });

      console.log(`✅ Fetched ${players.length} players from API-Football for ${team.name}`);
    } catch (e) {
      console.error('Failed to fetch players from API-Football:', e?.message || e);
      return res.status(500).json({ message: "Failed to fetch players from API" });
    }

    // Upsert players to database for proper saving
    const upsertedPlayers = [];
    for (const player of players) {
      const playerDoc = await Player.findOneAndUpdate(
        { apiId: player.apiId },
        {
          apiId: player.apiId,
          name: player.name,
          position: player.position,
          age: player.age,
          nationality: player.nationality,
          photo: player.photo,
          price: player.price,
          totalPoints: player.totalPoints,
          stats: player.stats || {}
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      upsertedPlayers.push(playerDoc);
    }

    res.json({
      team: {
        _id: team._id,
        name: team.name,
        logo: team.logo
      },
      players: upsertedPlayers.map(player => ({
        _id: player._id,
        name: player.name,
        position: player.position,
        age: player.age,
        nationality: player.nationality,
        photo: player.photo,
        price: player.price,
        totalPoints: player.totalPoints,
        stats: player.stats
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;