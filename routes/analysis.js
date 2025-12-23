const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// ===============================
// 🌍 قاعدة بيانات شاملة للدوريات والبطولات العالمية
// ===============================
const WORLD_LEAGUES = {
  england: [
    { name: "Premier League", nameAr: "الدوري الإنجليزي الممتاز", country: "England", countryAr: "إنجلترا", tier: 1, type: "league" },
    { name: "Championship", nameAr: "الدرجة الأولى الإنجليزية", country: "England", countryAr: "إنجلترا", tier: 2, type: "league" },
    { name: "FA Cup", nameAr: "كأس الاتحاد الإنجليزي", country: "England", countryAr: "إنجلترا", tier: 1, type: "cup" },
    { name: "League Cup", nameAr: "كأس الرابطة الإنجليزية", country: "England", countryAr: "إنجلترا", tier: 1, type: "cup" },
    { name: "Community Shield", nameAr: "درع الاتحاد الإنجليزي", country: "England", countryAr: "إنجلترا", tier: 1, type: "super_cup" }
  ],

  // 🇪🇸 إسبانيا
  spain: [
    { name: "La Liga", nameAr: "الدوري الإسباني", country: "Spain", countryAr: "إسبانيا", tier: 1, type: "league" },
    { name: "Segunda Division", nameAr: "الدرجة الثانية الإسبانية", country: "Spain", countryAr: "إسبانيا", tier: 2, type: "league" },
    { name: "Copa del Rey", nameAr: "كأس ملك إسبانيا", country: "Spain", countryAr: "إسبانيا", tier: 1, type: "cup" },
    { name: "Supercopa de España", nameAr: "كأس السوبر الإسباني", country: "Spain", countryAr: "إسبانيا", tier: 1, type: "super_cup" }
  ],

  // 🇮🇹 إيطاليا
  italy: [
    { name: "Serie A", nameAr: "الدوري الإيطالي", country: "Italy", countryAr: "إيطاليا", tier: 1, type: "league" },
    { name: "Serie B", nameAr: "الدرجة الثانية الإيطالية", country: "Italy", countryAr: "إيطاليا", tier: 2, type: "league" },
    { name: "Coppa Italia", nameAr: "كأس إيطاليا", country: "Italy", countryAr: "إيطاليا", tier: 1, type: "cup" },
    { name: "Supercoppa Italiana", nameAr: "كأس السوبر الإيطالي", country: "Italy", countryAr: "إيطاليا", tier: 1, type: "super_cup" }
  ],

  // 🇩🇪 ألمانيا
  germany: [
    { name: "Bundesliga", nameAr: "الدوري الألماني", country: "Germany", countryAr: "ألمانيا", tier: 1, type: "league" },
    { name: "2. Bundesliga", nameAr: "الدرجة الثانية الألمانية", country: "Germany", countryAr: "ألمانيا", tier: 2, type: "league" },
    { name: "DFB Pokal", nameAr: "كأس ألمانيا", country: "Germany", countryAr: "ألمانيا", tier: 1, type: "cup" },
    { name: "DFL Supercup", nameAr: "كأس السوبر الألماني", country: "Germany", countryAr: "ألمانيا", tier: 1, type: "super_cup" }
  ],

  // 🇫🇷 فرنسا
  france: [
    { name: "Ligue 1", nameAr: "الدوري الفرنسي", country: "France", countryAr: "فرنسا", tier: 1, type: "league" },
    { name: "Ligue 2", nameAr: "الدرجة الثانية الفرنسية", country: "France", countryAr: "فرنسا", tier: 2, type: "league" },
    { name: "Coupe de France", nameAr: "كأس فرنسا", country: "France", countryAr: "فرنسا", tier: 1, type: "cup" },
    { name: "Trophée des Champions", nameAr: "كأس السوبر الفرنسي", country: "France", countryAr: "فرنسا", tier: 1, type: "super_cup" }
  ],

  // 🏆 أوروبا - UEFA
  uefa: [
    { name: "UEFA Champions League", nameAr: "دوري أبطال أوروبا", country: "Europe", countryAr: "أوروبا", tier: 1, type: "continental" },
    { name: "UEFA Europa League", nameAr: "الدوري الأوروبي", country: "Europe", countryAr: "أوروبا", tier: 2, type: "continental" },
    { name: "UEFA Europa Conference League", nameAr: "دوري المؤتمر الأوروبي", country: "Europe", countryAr: "أوروبا", tier: 3, type: "continental" },
    { name: "UEFA Super Cup", nameAr: "كأس السوبر الأوروبي", country: "Europe", countryAr: "أوروبا", tier: 1, type: "super_cup" },
    { name: "UEFA Nations League", nameAr: "دوري الأمم الأوروبية", country: "Europe", countryAr: "أوروبا", tier: 1, type: "national_teams" }
  ],

  // 🌍 عالمي - FIFA
  fifa: [
    { name: "FIFA World Cup", nameAr: "كأس العالم", country: "World", countryAr: "العالم", tier: 1, type: "world_cup" },
    { name: "FIFA Club World Cup", nameAr: "كأس العالم للأندية", country: "World", countryAr: "العالم", tier: 1, type: "club_world_cup" },
    { name: "FIFA Confederations Cup", nameAr: "كأس القارات", country: "World", countryAr: "العالم", tier: 1, type: "confederations" }
  ],

  // 🇪🇬 مصر
  egypt: [
    { name: "Egyptian Premier League", nameAr: "الدوري المصري الممتاز", country: "Egypt", countryAr: "مصر", tier: 1, type: "league" },
    { name: "Egypt Cup", nameAr: "كأس مصر", country: "Egypt", countryAr: "مصر", tier: 1, type: "cup" },
    { name: "Egyptian Super Cup", nameAr: "كأس السوبر المصري", country: "Egypt", countryAr: "مصر", tier: 1, type: "super_cup" }
  ],

  // 🇸🇦 السعودية
  saudi: [
    { name: "Saudi Pro League", nameAr: "دوري روشن السعودي", country: "Saudi Arabia", countryAr: "السعودية", tier: 1, type: "league" },
    { name: "Saudi First Division", nameAr: "دوري الدرجة الأولى السعودي", country: "Saudi Arabia", countryAr: "السعودية", tier: 2, type: "league" },
    { name: "King Cup", nameAr: "كأس الملك", country: "Saudi Arabia", countryAr: "السعودية", tier: 1, type: "cup" },
    { name: "Saudi Super Cup", nameAr: "كأس السوبر السعودي", country: "Saudi Arabia", countryAr: "السعودية", tier: 1, type: "super_cup" }
  ],

  // 🇦🇪 الإمارات
  uae: [
    { name: "UAE Pro League", nameAr: "دوري أدنوك الإماراتي", country: "UAE", countryAr: "الإمارات", tier: 1, type: "league" },
    { name: "UAE President's Cup", nameAr: "كأس رئيس الدولة الإماراتي", country: "UAE", countryAr: "الإمارات", tier: 1, type: "cup" },
    { name: "UAE Super Cup", nameAr: "كأس السوبر الإماراتي", country: "UAE", countryAr: "الإمارات", tier: 1, type: "super_cup" }
  ],

  // 🇶🇦 قطر
  qatar: [
    { name: "Qatar Stars League", nameAr: "دوري نجوم قطر", country: "Qatar", countryAr: "قطر", tier: 1, type: "league" },
    { name: "Emir of Qatar Cup", nameAr: "كأس الأمير القطري", country: "Qatar", countryAr: "قطر", tier: 1, type: "cup" },
    { name: "Qatar Cup", nameAr: "كأس قطر", country: "Qatar", countryAr: "قطر", tier: 1, type: "cup" }
  ],

  // 🇲🇦 المغرب
  morocco: [
    { name: "Botola Pro", nameAr: "الدوري المغربي الممتاز", country: "Morocco", countryAr: "المغرب", tier: 1, type: "league" },
    { name: "Moroccan Throne Cup", nameAr: "كأس العرش المغربي", country: "Morocco", countryAr: "المغرب", tier: 1, type: "cup" }
  ],

  // 🇹🇳 تونس
  tunisia: [
    { name: "Tunisian Ligue Professionnelle 1", nameAr: "الرابطة المحترفة التونسية الأولى", country: "Tunisia", countryAr: "تونس", tier: 1, type: "league" },
    { name: "Tunisian Cup", nameAr: "كأس تونس", country: "Tunisia", countryAr: "تونس", tier: 1, type: "cup" }
  ],

  // 🇩🇿 الجزائر
  algeria: [
    { name: "Algerian Ligue Professionnelle 1", nameAr: "الرابطة المحترفة الجزائرية الأولى", country: "Algeria", countryAr: "الجزائر", tier: 1, type: "league" },
    { name: "Algerian Cup", nameAr: "كأس الجزائر", country: "Algeria", countryAr: "الجزائر", tier: 1, type: "cup" }
  ],

  // 🇮🇶 العراق
  iraq: [
    { name: "Iraqi Premier League", nameAr: "الدوري العراقي الممتاز", country: "Iraq", countryAr: "العراق", tier: 1, type: "league" },
    { name: "Iraqi Cup", nameAr: "كأس العراق", country: "Iraq", countryAr: "العراق", tier: 1, type: "cup" }
  ],

  // 🏆 إفريقيا - CAF
  caf: [
    { name: "CAF Champions League", nameAr: "دوري أبطال أفريقيا", country: "Africa", countryAr: "أفريقيا", tier: 1, type: "continental" },
    { name: "CAF Confederation Cup", nameAr: "كأس الكونفدرالية الأفريقية", country: "Africa", countryAr: "أفريقيا", tier: 2, type: "continental" },
    { name: "CAF Super Cup", nameAr: "كأس السوبر الأفريقي", country: "Africa", countryAr: "أفريقيا", tier: 1, type: "super_cup" },
    { name: "Africa Cup of Nations", nameAr: "كأس أمم أفريقيا", country: "Africa", countryAr: "أفريقيا", tier: 1, type: "national_teams" },
    { name: "CAF Africa Cup of Nations", nameAr: "كأس أمم أفريقيا", country: "Africa", countryAr: "أفريقيا", tier: 1, type: "national_teams" }
  ],

  // 🏆 آسيا - AFC
  afc: [
    { name: "AFC Champions League", nameAr: "دوري أبطال آسيا", country: "Asia", countryAr: "آسيا", tier: 1, type: "continental" },
    { name: "AFC Cup", nameAr: "كأس الاتحاد الآسيوي", country: "Asia", countryAr: "آسيا", tier: 2, type: "continental" },
    { name: "AFC Asian Cup", nameAr: "كأس آسيا", country: "Asia", countryAr: "آسيا", tier: 1, type: "national_teams" },
    { name: "Asian Cup", nameAr: "كأس آسيا", country: "Asia", countryAr: "آسيا", tier: 1, type: "national_teams" }
  ],

  // 🏆 عربي
  arab: [
    { name: "Arab Club Champions Cup", nameAr: "كأس العرب للأندية الأبطال", country: "Arab World", countryAr: "الوطن العربي", tier: 1, type: "continental" },
    { name: "FIFA Arab Cup", nameAr: "كأس العرب", country: "Arab World", countryAr: "الوطن العربي", tier: 1, type: "national_teams" }
  ]
};

// دمج كل الدوريات في مصفوفة واحدة
const ALL_LEAGUES = Object.values(WORLD_LEAGUES).flat();

// ===============================
// 🔍 دالة البحث الذكية عن الدوري
// ===============================
const findLeagueInfo = (tournamentName, tournamentCountry = null) => {
  // بحث دقيق بالاسم
  let league = ALL_LEAGUES.find(l => 
    l.name.toLowerCase() === tournamentName.toLowerCase() ||
    l.nameAr === tournamentName
  );

  // إذا كان هناك دولة، نتأكد منها أيضاً
  if (league && tournamentCountry) {
    const countryMatch = league.country.toLowerCase() === tournamentCountry.toLowerCase() ||
                        league.countryAr === tournamentCountry;
    if (!countryMatch) {
      league = null;
    }
  }

  // بحث جزئي إذا لم نجد تطابق كامل
  if (!league) {
    league = ALL_LEAGUES.find(l => 
      l.name.toLowerCase().includes(tournamentName.toLowerCase()) ||
      tournamentName.toLowerCase().includes(l.name.toLowerCase())
    );
  }

  return league;
};

// ===============================
// 🎯 فلتر متقدم للبطولات
// ===============================
const isMajorLeague = (tournament) => {
  if (!tournament || !tournament.name) return false;
  
  const leagueInfo = findLeagueInfo(tournament.name, tournament.country);
  
  // نقبل الدوريات من Tier 1 و 2 والبطولات القارية
  return leagueInfo && (leagueInfo.tier <= 2 || leagueInfo.type === 'continental');
};

// ===============================
// 🌟 إثراء بيانات التحليل
// ===============================
const enrichAnalysis = (analysis) => {
  const leagueInfo = findLeagueInfo(analysis.tournament.name, analysis.tournament.country);
  
  if (leagueInfo) {
    return {
      ...analysis.toObject(),
      tournament: {
        ...analysis.tournament,
        nameAr: leagueInfo.nameAr,
        countryAr: leagueInfo.countryAr,
        tier: leagueInfo.tier,
        type: leagueInfo.type
      },
      enriched: true
    };
  }
  
  return analysis.toObject();
};

// ===============================
// 📊 TEST - اختبار النظام
// ===============================
router.get('/test', async (req, res) => {
  try {
    const count = await Analysis.countDocuments();
    const latest = await Analysis.findOne().sort({ createdAt: -1 });
    const majorLeaguesCount = await Analysis.countDocuments({
      'tournament.name': { $in: ALL_LEAGUES.map(l => l.name) }
    });

    res.json({
      success: true,
      message: '✅ نظام التحليل الاحترافي يعمل بكفاءة عالية',
      stats: {
        totalAnalyses: count,
        majorLeaguesAnalyses: majorLeaguesCount,
        supportedLeagues: ALL_LEAGUES.length,
        supportedCountries: [...new Set(ALL_LEAGUES.map(l => l.country))].length
      },
      latestAnalysis: latest ? enrichAnalysis(latest) : null,
      timestamp: new Date(),
      system: {
        version: '2.0.0',
        features: [
          'تحليل ذكي بالعربية',
          'دعم 50+ دوري ومسابقة',
          'فلترة متقدمة',
          'إحصائيات دقيقة',
          'ترجمة تلقائية'
        ]
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===============================
// 🔍 SEARCH - بحث ذكي متقدم
// ===============================
router.get('/search/query', async (req, res) => {
  try {
    const q = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 2) {
      return res.json({ 
        success: true, 
        data: [],
        message: 'يرجى إدخال كلمة بحث صحيحة (حرفين على الأقل)'
      });
    }

    // بحث شامل
    const searchQuery = {
      $or: [
        { "homeTeam.name": { $regex: q, $options: 'i' } },
        { "awayTeam.name": { $regex: q, $options: 'i' } },
        { "tournament.name": { $regex: q, $options: 'i' } },
        { "tournament.country": { $regex: q, $options: 'i' } },
        { "venue": { $regex: q, $options: 'i' } }
      ]
    };

    const total = await Analysis.countDocuments(searchQuery);
    const results = await Analysis.find(searchQuery)
      .sort({ createdAt: -1, views: -1 })
      .skip(skip)
      .limit(limit);

    // إثراء النتائج
    const enrichedResults = results.map(enrichAnalysis);

    res.json({ 
      success: true, 
      data: enrichedResults,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      query: q
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 🔥 TRENDING - الأكثر رواجاً
// ===============================
router.get('/trending/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const timeframe = req.query.timeframe || 'all'; // all, today, week, month

    let dateFilter = {};
    if (timeframe !== 'all') {
      const now = new Date();
      if (timeframe === 'today') {
        dateFilter = { createdAt: { $gte: new Date(now.setHours(0,0,0,0)) } };
      } else if (timeframe === 'week') {
        dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
      } else if (timeframe === 'month') {
        dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
      }
    }

    const analyses = await Analysis.find(dateFilter)
      .sort({ views: -1, likes: -1 })
      .limit(limit * 2); // نأخذ ضعف العدد للتصفية

    // تصفية قوية للدوريات الكبرى فقط
    const filtered = analyses
      .filter(a => isMajorLeague(a.tournament))
      .slice(0, limit);

    const enriched = filtered.map(enrichAnalysis);

    res.json({ 
      success: true, 
      data: enriched,
      timeframe,
      count: enriched.length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// ⚙️ FILTER OPTIONS - خيارات الفلترة
// ===============================
router.get('/filter/options', async (req, res) => {
  try {
    // الحصول على كل الدوريات المتاحة من قاعدة البيانات
    const tournaments = await Analysis.distinct('tournament.name');
    
    // تصفية الدوريات الكبرى فقط
    const majorTournaments = tournaments
      .map(name => {
        const info = findLeagueInfo(name);
        return info ? { ...info, available: true } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.tier - b.tier);

    // تجميع حسب المنطقة
    const groupedByRegion = {
      europe: majorTournaments.filter(t => ['England', 'Spain', 'Italy', 'Germany', 'France', 'Europe'].includes(t.country)),
      arab: majorTournaments.filter(t => ['Egypt', 'Saudi Arabia', 'UAE', 'Qatar', 'Morocco', 'Tunisia', 'Algeria', 'Iraq', 'Arab World'].includes(t.country)),
      africa: majorTournaments.filter(t => t.country === 'Africa'),
      asia: majorTournaments.filter(t => t.country === 'Asia'),
      world: majorTournaments.filter(t => t.country === 'World')
    };

    res.json({ 
      success: true, 
      data: {
        all: majorTournaments,
        byRegion: groupedByRegion,
        stats: {
          total: majorTournaments.length,
          europe: groupedByRegion.europe.length,
          arab: groupedByRegion.arab.length,
          africa: groupedByRegion.africa.length,
          asia: groupedByRegion.asia.length,
          world: groupedByRegion.world.length
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 📈 DAILY STATS - إحصائيات يومية
// ===============================
router.get('/stats/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const stats = await Analysis.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            tournament: "$tournament.name"
          },
          count: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likes" }
        }
      },
      { 
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          totalViews: { $sum: "$totalViews" },
          totalLikes: { $sum: "$totalLikes" },
          tournaments: { 
            $push: { 
              name: "$_id.tournament", 
              count: "$count" 
            } 
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: days }
    ]);

    // إحصائيات إضافية
    const topTournaments = await Analysis.aggregate([
      {
        $group: {
          _id: "$tournament.name",
          count: { $sum: 1 },
          totalViews: { $sum: "$views" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ 
      success: true, 
      data: {
        daily: stats,
        topTournaments: topTournaments.map(t => ({
          ...t,
          info: findLeagueInfo(t._id)
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 🤖 GENERATE - توليد تحليل احترافي
// ===============================
router.post('/generate', async (req, res) => {
  try {
    const matchData = req.body;

    // التحقق من البيانات المطلوبة
    if (!matchData.homeTeam || !matchData.awayTeam || !matchData.score) {
      return res.status(400).json({
        success: false,
        error: 'بيانات المباراة غير مكتملة'
      });
    }

    // إثراء بيانات البطولة
    const leagueInfo = findLeagueInfo(
      matchData.tournament?.name, 
      matchData.tournament?.country
    );

    if (leagueInfo) {
      matchData.tournament = {
        ...matchData.tournament,
        nameAr: leagueInfo.nameAr,
        countryAr: leagueInfo.countryAr
      };
    }

    // توليد التحليل باستخدام AI
    const result = await analyzeMatch(matchData);

    res.json({
      success: true,
      data: result,
      message: 'تم توليد التحليل بنجاح'
    });

  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===============================
// 📋 PAGINATED LIST - قائمة مع ترقيم
// ===============================
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const tournament = req.query.tournament;
    const country = req.query.country;
    const type = req.query.type; // league, cup, continental
    const tier = req.query.tier;

    // بناء الفلتر
    let filter = {};
    
    if (tournament) {
      filter['tournament.name'] = { $regex: tournament, $options: 'i' };
    }
    
    if (country) {
      filter['tournament.country'] = { $regex: country, $options: 'i' };
    }

    // الحصول على كل التحليلات مع الفلتر
    const allAnalyses = await Analysis.find(filter).sort({ createdAt: -1 });

    // تصفية الدوريات الكبرى
    let filtered = allAnalyses.filter(a => isMajorLeague(a.tournament));

    // فلترة إضافية حسب النوع والمستوى
    if (type || tier) {
      filtered = filtered.filter(a => {
        const info = findLeagueInfo(a.tournament.name, a.tournament.country);
        if (!info) return false;
        
        if (type && info.type !== type) return false;
        if (tier && info.tier !== parseInt(tier)) return false;
        
        return true;
      });
    }

    // إثراء البيانات
    const enriched = filtered.map(enrichAnalysis);

    // الترقيم
    const paginatedData = enriched.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: enriched.length,
        pages: Math.ceil(enriched.length / limit),
        hasNext: page < Math.ceil(enriched.length / limit),
        hasPrev: page > 1
      },
      filters: {
        tournament,
        country,
        type,
        tier
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 🎯 SINGLE ANALYSIS - تحليل واحد
// ===============================
router.get('/:matchId', async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ matchId: req.params.matchId });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "التحليل غير موجود"
      });
    }

    // زيادة عدد المشاهدات
    analysis.views = (analysis.views || 0) + 1;
    await analysis.save();

    // إثراء البيانات
    const enriched = enrichAnalysis(analysis);

    // الحصول على تحليلات مشابهة
    const similar = await Analysis.find({
      $or: [
        { 'tournament.name': analysis.tournament.name },
        { 'homeTeam.name': { $in: [analysis.homeTeam.name, analysis.awayTeam.name] } },
        { 'awayTeam.name': { $in: [analysis.homeTeam.name, analysis.awayTeam.name] } }
      ],
      matchId: { $ne: analysis.matchId }
    })
    .sort({ createdAt: -1 })
    .limit(5);

    const enrichedSimilar = similar.map(enrichAnalysis);

    res.json({ 
      success: true, 
      data: enriched,
      similar: enrichedSimilar
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 📊 LEAGUES INFO - معلومات الدوريات
// ===============================
router.get('/info/leagues', (req, res) => {
  try {
    const region = req.query.region; // europe, arab, africa, asia, world

    let leagues = ALL_LEAGUES;

    if (region) {
      const regionMap = {
        europe: ['England', 'Spain', 'Italy', 'Germany', 'France', 'Europe'],
        arab: ['Egypt', 'Saudi Arabia', 'UAE', 'Qatar', 'Morocco', 'Tunisia', 'Algeria', 'Iraq', 'Arab World'],
        africa: ['Africa'],
        asia: ['Asia'],
        world: ['World']
      };

      if (regionMap[region]) {
        leagues = leagues.filter(l => regionMap[region].includes(l.country));
      }
    }

    res.json({
      success: true,
      data: leagues,
      count: leagues.length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 💡 SUGGESTIONS - اقتراحات
// ===============================
router.get('/suggestions/teams', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    if (query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    // البحث عن الفرق
    const teams = await Analysis.aggregate([
      {
        $match: {
          $or: [
            { 'homeTeam.name': { $regex: query, $options: 'i' } },
            { 'awayTeam.name': { $regex: query, $options: 'i' } }
          ]
        }
      },
      {
        $project: {
          teams: [
            { name: '$homeTeam.name', logo: '$homeTeam.logo' },
            { name: '$awayTeam.name', logo: '$awayTeam.logo' }
          ]
        }
      },
      { $unwind: '$teams' },
      {
        $group: {
          _id: '$teams.name',
          logo: { $first: '$teams.logo' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: teams.map(t => ({
        name: t._id,
        logo: t.logo,
        matchesCount: t.count
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
