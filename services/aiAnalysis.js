const Groq = require('groq-sdk');
const Analysis = require('../models/Analysis');

// INIT AI CLIENT
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Helper: get universal matchId
function getMatchId(data) {
  return data.matchId || data.apiId || data._id || data.fixture?.id;
}

async function analyzeMatch(matchData) {
  const start = Date.now();

  try {
    const matchId = getMatchId(matchData);

    if (!matchId) {
      throw new Error(`❌ Missing matchId`);
    }

    console.log(`🎯 Analyzing: ${matchData.homeTeam.name} vs ${matchData.awayTeam.name} → ID: ${matchId}`);

    const exists = await Analysis.findByMatchId(matchId);
    if (exists) {
      console.log(`⚠️ Already exists → skipping.`);
      return exists;
    }

    const prompt = buildPrompt(matchData);

    // CALL GROQ AI
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'أنت محلل كرة قدم محترف تقدم تحليلاً عربياً مفصلاً.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 3000,
      top_p: 0.9
    });

    const fullText = completion.choices[0].message.content;
    const structured = parse(fullText);

    const analysis = new Analysis({
      matchId,
      homeTeam: {
        id: matchData.homeTeam.id,
        name: matchData.homeTeam.name,
        logo: matchData.homeTeam.logo
      },
      awayTeam: {
        id: matchData.awayTeam.id,
        name: matchData.awayTeam.name,
        logo: matchData.awayTeam.logo
      },
      score: {
        home: matchData.score?.home || matchData.scoreA || 0,
        away: matchData.score?.away || matchData.scoreB || 0
      },
      tournament: {
        id: matchData.tournament.id,
        name: matchData.tournament.name,
        country: matchData.tournament.country,
        logo: matchData.tournament.logo
      },
      venue: matchData.venue,
      date: new Date(matchData.date),
      status: matchData.status,

      analysis: {
        summary: structured.summary,
        performance: structured.performance,
        keyPlayers: structured.keyPlayers,
        tactics: structured.tactics,
        statistics: structured.statistics,
        strengths: structured.strengths,
        weaknesses: structured.weaknesses,
        fullText
      },

      aiModel: "groq-llama-3.3-70b",
      processingTime: Date.now() - start,
      isPublished: true
    });

    await analysis.save();

    console.log(`✅ DONE in ${Date.now() - start}ms`);

    return analysis;

  } catch (err) {
    console.error(`❌ AI FAILED → using fallback. Reason: ${err.message}`);

    return fallback(matchData);
  }
}

/**
 * BUILD AI PROMPT
 */
function buildPrompt(m) {
  const score = `${m.score?.home || m.scoreA} - ${m.score?.away || m.scoreB}`;

  return `
حلل هذه المباراة:

${m.homeTeam.name} ضد ${m.awayTeam.name}
النتيجة: ${score}
البطولة: ${m.tournament.name}
الملعب: ${m.venue || 'غير محدد'}
التاريخ: ${new Date(m.date).toLocaleDateString('ar-EG')}

اكتب:
- ملخص
- أداء الفريقين
- اللاعبون المؤثرون
- التكتيكات
- الإحصائيات
- نقاط القوة والضعف
بأسلوب احترافي عربي.
  `;
}

/**
 * PARSE TEXT
 */
function parse(text) {
  return {
    summary: extract(text, ['ملخص', 'summary']),
    performance: {
      overall: extract(text, ['الأداء', 'performance'])
    },
    keyPlayers: extract(text, ['لاعب', 'مؤثر']),
    tactics: {
      comparison: extract(text, ['تكتيك', 'خطة'])
    },
    statistics: extract(text, ['إحصائ', 'statistic']),
    strengths: { homeTeam: [], awayTeam: [] },
    weaknesses: { homeTeam: [], awayTeam: [] }
  };
}

function extract(text, keys) {
  const lines = text.split('\n');
  const found = lines.filter(l => keys.some(k => l.includes(k)));
  return found.join('\n').trim() || text.slice(0, 300);
}

function fallback(m) {
  const score = `${m.score?.home || 0} - ${m.score?.away || 0}`;

  const txt = `
انتهت مباراة ${m.homeTeam.name} ضد ${m.awayTeam.name} بنتيجة ${score}.
التحليل الكامل غير متوفر حالياً وسيتم توليده قريباً تلقائياً.
  `;

  return {
    matchId: getMatchId(m),
    analysis: {
      summary: txt,
      fullText: txt
    }
  };
}

module.exports = {
  analyzeMatch,
  analyzeMultipleMatches: async matches => {
    const arr = [];
    for (const m of matches) arr.push(await analyzeMatch(m));
    return arr;
  }
};
