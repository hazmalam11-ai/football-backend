const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// ===============================
// 🏆 الدوريات و البطولات المسموح بها
// ===============================
const MAJOR_LEAGUES = [
  // الدوريات الأوروبية الكبرى
  { name: "Premier League", country: "England" },
  { name: "La Liga", country: "Spain" },
  { name: "Serie A", country: "Italy" },
  { name: "Bundesliga", country: "Germany" },
  { name: "Ligue 1", country: "France" },

  // بطولات أوروبا
  { name: "UEFA Champions League" },
  { name: "UEFA Europa League" },
  { name: "UEFA Europa Conference League" },
  { name: "UEFA Super Cup" },

  // البطولات العالمية
  { name: "FIFA Club World Cup" },
  { name: "FIFA World Cup" },

  // الدوريات العربية
  { name: "Egyptian Premier League", country: "Egypt" },
  { name: "Saudi Pro League", country: "Saudi Arabia" },
  { name: "Botola Pro", country: "Morocco" },
  { name: "Qatar Stars League", country: "Qatar" },
  { name: "UAE Pro League", country: "UAE" },
  { name: "Tunisian Ligue Professionnelle 1", country: "Tunisia" },
  { name: "Algerian Ligue Professionnelle 1", country: "Algeria" },

  // بطولات قارية
  { name: "CAF Champions League" },
  { name: "CAF Confederation Cup" },
  { name: "AFC Champions League" },
  { name: "AFC Asian Cup" },
  { name: "CAF Africa Cup of Nations" },
  { name: "Arab Club Champions Cup" }
];

// ← استخرج أسماء البطولات فقط
const MAJOR_COMPETITIONS = MAJOR_LEAGUES.map(l => l.name);


// ===============================
// TEST ROUTE
// ===============================
router.get('/test', async (req, res) => {
  try {
    const count = await Analysis.countDocuments();
    const latest = await Analysis.findOne().sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Analysis API is working',
      totalAnalyses: count,
      latestAnalysis: latest || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// SEARCH
// ===============================
router.get('/search/query', async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) return res.json({ success: true, data: [] });

    const results = await Analysis.find({
      $or: [
        { "homeTeam.name": { $regex: q, $options: 'i' } },
        { "awayTeam.name": { $regex: q, $options: 'i' } },
        { "tournament.name": { $regex: q, $options: 'i' } },
        { "analysis.summary": { $regex: q, $options: 'i' } }
      ]
    }).limit(50);

    return res.json({ success: true, data: results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// TRENDING
// ===============================
router.get('/trending/list', async (req, res) => {
  try {
    const analyses = await Analysis.find({
      "tournament.name": { $in: MAJOR_COMPETITIONS }
    })
      .sort({ views: -1 })
      .limit(10);

    return res.json({ success: true, data: analyses });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// FILTER OPTIONS
// ===============================
router.get('/filter/options', async (req, res) => {
  try {
    const query = {
      "tournament.name": { $in: MAJOR_COMPETITIONS }
    };

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


// ===============================
// DAILY STATS
// ===============================
router.get('/stats/daily', async (req, res) => {
  try {
    const stats = await Analysis.aggregate([
      {
        $match: { "tournament.name": { $in: MAJOR_COMPETITIONS } }
      },
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


// ===============================
// GENERATE
// ===============================
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


// ===============================
// PAGINATED LIST (MAJOR ONLY)
// ===============================
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const analyses = await Analysis.find({
      "tournament.name": { $in: MAJOR_COMPETITIONS }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const count = await Analysis.countDocuments({
      "tournament.name": { $in: MAJOR_COMPETITIONS }
    });

    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      data: analyses
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// GET SINGLE
// ===============================
router.get('/:matchId', async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ matchId: req.params.matchId });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: `No analysis found for match: ${req.params.matchId}`
      });
    }

    return res.json({ success: true, data: analysis });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
