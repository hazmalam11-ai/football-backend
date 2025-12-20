const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// ===============================
// 🏆 الدوريات و البطولات المسموح بها (اسم + دولة)
// ===============================
const MAJOR_LEAGUES = [
  // الدوريات الأوروبية الكبرى
  { name: "Premier League", country: "England" },
  { name: "La Liga", country: "Spain" },
  { name: "Serie A", country: "Italy" },
  { name: "Bundesliga", country: "Germany" },
  { name: "Ligue 1", country: "France" },

  // Cups
  { name: "FA Cup", country: "England" },
  { name: "Copa del Rey", country: "Spain" },
  { name: "Coppa Italia", country: "Italy" },
  { name: "DFB Pokal", country: "Germany" },
  { name: "Coupe de France", country: "France" },

  // UEFA
  { name: "UEFA Champions League" },
  { name: "UEFA Europa League" },
  { name: "UEFA Europa Conference League" },
  { name: "UEFA Super Cup" },

  // World
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


// ============
// أسماء فقط
// ============
const MAJOR_COMPETITIONS = MAJOR_LEAGUES.map(l => l.name);


// ============
// فلتر بالقوة: بالاسم + الدولة لو متاحة
// ============
const isMajorLeague = (tournament) => {
  return MAJOR_LEAGUES.some(l =>
    l.name === tournament.name &&
    (!l.country || l.country === tournament.country)
  );
};

// ===============================
// TEST
// ===============================
router.get('/test', async (req, res) => {
  try {
    const count = await Analysis.countDocuments();
    const latest = await Analysis.findOne().sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Analysis API is working',
      totalAnalyses: count,
      latestAnalysis: latest,
      timestamp: new Date()
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
        { "tournament.name": { $regex: q, $options: 'i' } }
      ]
    }).limit(50);

    res.json({ success: true, data: results });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// TRENDING
// ===============================
router.get('/trending/list', async (req, res) => {
  try {
    const analyses = await Analysis.find()
      .sort({ views: -1 })
      .limit(50);

    // تصفية قوية
    const filtered = analyses.filter(a => isMajorLeague(a.tournament));

    res.json({ success: true, data: filtered.slice(0, 10) });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// FILTER OPTIONS
// ===============================
router.get('/filter/options', async (req, res) => {
  try {
    let analyses = await Analysis.find().sort({ createdAt: -1 });

    analyses = analyses.filter(a => isMajorLeague(a.tournament));

    res.json({ success: true, data: analyses.slice(0, 50) });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// DAILY STATS
// ===============================
router.get('/stats/daily', async (req, res) => {
  try {
    const stats = await Analysis.aggregate([
      {
        $match: {
          "tournament.name": { $in: MAJOR_COMPETITIONS }
        }
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

    res.json({ success: true, data: stats });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// GENERATE
// ===============================
router.post('/generate', async (req, res) => {
  try {
    const result = await analyzeMatch(req.body);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// PAGINATED (قوي)
// ===============================
router.get('/', async (req, res) => {
  try {
    const all = await Analysis.find().sort({ createdAt: -1 });

    const filtered = all.filter(a => isMajorLeague(a.tournament));

    res.json({
      success: true,
      total: filtered.length,
      data: filtered.slice(0, 50)
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// SINGLE
// ===============================
router.get('/:matchId', async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ matchId: req.params.matchId });

    if (!analysis)
      return res.status(404).json({
        success: false,
        message: "Not found"
      });

    res.json({ success: true, data: analysis });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
