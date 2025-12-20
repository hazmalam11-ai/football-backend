const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// ===============================
// 🏆 الدوريات و البطولات المسموح بها
// ===============================
const MAJOR_COMPETITIONS = [
  // الدوريات الأوروبية الكبرى
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",

  // بطولات أوروبا
  "UEFA Champions League",
  "UEFA Europa League",
  "UEFA Europa Conference League",
  "UEFA Super Cup",

  // العالمية
  "FIFA Club World Cup",
  "FIFA World Cup",

  // الدوريات العربية
  "Egyptian Premier League",
  "Saudi Pro League",
  "Botola Pro",
  "Qatar Stars League",
  "UAE Pro League",
  "Tunisian Ligue Professionnelle 1",
  "Algerian Ligue Professionnelle 1",

  // بطولات قارية
  "CAF Champions League",
  "CAF Confederation Cup",
  "AFC Champions League",
  "AFC Asian Cup",
  "CAF Africa Cup of Nations",
  "Arab Club Champions Cup"
];

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
// PAGINATED LIST (MAJOR ONLY!)
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
// GET SINGLE (NO FILTER)
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
