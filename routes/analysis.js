const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// ==========================================
// STATIC ROUTES
// ==========================================

router.get('/test', async (req, res) => {
  try {
    const count = await Analysis.countDocuments();
    const latest = await Analysis.findOne().sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Analysis API is working',
      totalAnalyses: count,
      latestAnalysis: latest ? {
        matchId: latest.matchId,
        homeTeam: latest.homeTeam.name,
        awayTeam: latest.awayTeam.name,
        date: latest.date
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/search/query', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ success: true, data: [] });

    const results = await Analysis.find({
      $or: [
        { "homeTeam.name": { $regex: q, $options: 'i' } },
        { "awayTeam.name": { $regex: q, $options: 'i' } },
        { "tournament.name": { $regex: q, $options: 'i' } },
        { 'analysis.summary': { $regex: q, $options: 'i' } }
      ]
    }).limit(50);

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/trending/list', async (req, res) => {
  try {
    const analyses = await Analysis.find()
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({ success: true, data: analyses });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/filter/options', async (req, res) => {
  try {
    const query = {};

    if (req.query.team) {
      query.$or = [
        { "homeTeam.name": req.query.team },
        { "awayTeam.name": req.query.team }
      ];
    }

    if (req.query.tournament) {
      query["tournament.name"] = req.query.tournament;
    }

    if (req.query.date) {
      query.date = { $gte: new Date(req.query.date) };
    }

    const analyses = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ success: true, data: analyses });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/daily', async (req, res) => {
  try {
    const stats = await Analysis.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const matchData = req.body;

    if (!matchData || !matchData.homeTeam || !matchData.awayTeam) {
      return res.status(400).json({ success: false, message: 'Match data incomplete' });
    }

    const result = await analyzeMatch(matchData);

    return res.json({
      success: true,
      message: 'Analysis created',
      data: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PAGINATE LIST
// ==========================================

router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const analyses = await Analysis.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = analyses.map(a => ({
      matchId: a.matchId,
      homeTeam: a.homeTeam.name,
      awayTeam: a.awayTeam.name,
      homeTeamLogo: a.homeTeam.logo,
      awayTeamLogo: a.awayTeam.logo,
      scoreA: a.score.home,
      scoreB: a.score.away,
      tournament: a.tournament.name,
      tournamentLogo: a.tournament.logo,
      date: a.date,
      createdAt: a.createdAt
    }));

    const count = await Analysis.countDocuments();

    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      data: formatted
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// GET BY MATCH ID  (FIXED FORMAT)
// ==========================================

router.get('/:matchId', async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ matchId: req.params.matchId });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: `No analysis found for match: ${req.params.matchId}`
      });
    }

    const formatted = {
      matchId: analysis.matchId,
      homeTeam: analysis.homeTeam.name,
      awayTeam: analysis.awayTeam.name,
      homeTeamLogo: analysis.homeTeam.logo,
      awayTeamLogo: analysis.awayTeam.logo,
      scoreA: analysis.score.home,
      scoreB: analysis.score.away,
      tournament: analysis.tournament.name,
      tournamentLogo: analysis.tournament.logo,
      venue: analysis.venue,
      date: analysis.date,
      analysis: analysis.analysis,
      views: analysis.views,
      likes: analysis.likes,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    };

    return res.json({ success: true, data: formatted });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
