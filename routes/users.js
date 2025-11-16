const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { requireAuth, authorize } = require("../middlewares/auth");

// Alias for shorter usage in favorite endpoints
const auth = requireAuth;

// GET /users?search=ahmed&page=1&limit=20
router.get("/", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = (req.query.search || "").trim();
  const role = (req.query.role || "").trim();
    const filter = search
      ? { $or: [
          { username: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ] }
      : {};
  if (role && ["admin","moderator","editor","user"].includes(role)) {
    filter.role = role;
  }

    const [total, items] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("username email role createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.json({ total, page, limit, items });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id (admin cannot delete self)
router.delete("/:id", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id/role { role }
router.patch("/:id/role", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const allowed = ["admin", "moderator", "editor", "user"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("username email role");
    if (!updated) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "Role updated", user: updated });
  } catch (err) {
    next(err);
  }
});

// GET /users/favorites - Get user's favorite teams
router.get("/favorites", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("favoriteTeams");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({ 
      success: true, 
      favoriteTeams: user.favoriteTeams || [],
      count: user.favoriteTeams?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

// POST /users/favorites - Add team to favorites
router.post("/favorites", requireAuth, async (req, res, next) => {
  try {
    const { teamId, teamName, teamLogo, leagueName, leagueId } = req.body;
    
    if (!teamId || !teamName || !leagueName || !leagueId) {
      return res.status(400).json({ 
        success: false, 
        message: "teamId, teamName, leagueName, and leagueId are required" 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if team is already in favorites
    const existingFavorite = user.favoriteTeams.find(fav => fav.teamId === teamId);
    if (existingFavorite) {
      return res.status(400).json({ 
        success: false, 
        message: "Team is already in favorites" 
      });
    }

    // Add team to favorites
    user.favoriteTeams.push({
      teamId,
      teamName,
      teamLogo: teamLogo || "",
      leagueName,
      leagueId,
      addedAt: new Date()
    });

    await user.save();

    res.json({ 
      success: true, 
      message: "Team added to favorites",
      favoriteTeams: user.favoriteTeams
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/favorites/:teamId - Remove team from favorites
router.delete("/favorites/:teamId", requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        message: "Team ID is required" 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Remove team from favorites
    const initialLength = user.favoriteTeams.length;
    user.favoriteTeams = user.favoriteTeams.filter(fav => fav.teamId !== parseInt(teamId));
    
    if (user.favoriteTeams.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: "Team not found in favorites" 
      });
    }

    await user.save();

    res.json({ 
      success: true, 
      message: "Team removed from favorites",
      favoriteTeams: user.favoriteTeams
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/favorites/:teamId - Check if team is in favorites
router.get("/favorites/:teamId", requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;
    
    if (!teamId) {
      return res.status(400).json({ 
        success: false, 
        message: "Team ID is required" 
      });
    }

    const user = await User.findById(req.user.id).select("favoriteTeams");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isFavorite = user.favoriteTeams.some(fav => fav.teamId === parseInt(teamId));

    res.json({ 
      success: true, 
      isFavorite,
      teamId: parseInt(teamId)
    });
  } catch (err) {
    next(err);
  }
});

// ============= FAVORITE PLAYERS ENDPOINTS =============

// GET /users/favorite-players - Get all favorite players for the authenticated user
router.get('/favorite-players', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('favoritePlayers');
    res.json({ favoritePlayers: user.favoritePlayers || [] });
  } catch (err) {
    next(err);
  }
});

// POST /users/favorite-players - Add a player to favorites
router.post('/favorite-players', auth, async (req, res, next) => {
  try {
    const { playerId, playerName, playerPhoto, position, team, leagueName, leagueId } = req.body;

    // Validate required fields
    if (!playerId || !playerName || !team?.name || !leagueName || !leagueId) {
      return res.status(400).json({ 
        error: 'Missing required fields: playerId, playerName, team.name, leagueName, leagueId' 
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check if player is already in favorites
    const existingPlayer = user.favoritePlayers.find(
      player => player.playerId === parseInt(playerId)
    );
    
    if (existingPlayer) {
      return res.status(400).json({ error: 'Player already in favorites' });
    }

    // Add player to favorites
    user.favoritePlayers.push({
      playerId: parseInt(playerId),
      playerName,
      playerPhoto: playerPhoto || '',
      position: position || '',
      team: {
        name: team.name,
        logo: team.logo || ''
      },
      leagueName,
      leagueId: parseInt(leagueId),
      addedAt: new Date()
    });

    await user.save();
    res.json({ message: 'Player added to favorites', player: user.favoritePlayers[user.favoritePlayers.length - 1] });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/favorite-players/:playerId - Remove a player from favorites
router.delete('/favorite-players/:playerId', auth, async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const user = await User.findById(req.user.id);
    
    const playerIndex = user.favoritePlayers.findIndex(
      player => player.playerId === parseInt(playerId)
    );
    
    if (playerIndex === -1) {
      return res.status(404).json({ error: 'Player not found in favorites' });
    }

    user.favoritePlayers.splice(playerIndex, 1);
    await user.save();
    res.json({ message: 'Player removed from favorites' });
  } catch (err) {
    next(err);
  }
});

// GET /users/favorite-players/:playerId - Check if a specific player is in favorites
router.get('/favorite-players/:playerId', auth, async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const user = await User.findById(req.user.id);
    
    const isFavorite = user.favoritePlayers.some(
      player => player.playerId === parseInt(playerId)
    );
    
    res.json({ isFavorite });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
