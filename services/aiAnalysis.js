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
      console.log(`⚠️ Analysis exists → skipping.`);
      return exists;
    }

    const prompt = buildPrompt(matchData);

    // CALL GROQ AI
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `
أنت محلل كرة قدم عربي محترف.
يجب أن يكون التحليل عربي بالكامل فقط.
ممنوع استخدام كلمات أو أحرف إنجليزية.
اكتب بأسلوب بشري احترافي متماسك وواضح وواقعي.
استخدم لغة عربية رياضية احترافية.
لا تذكر ID أو أي رموز.
اكتب المحتوى بأسلوب محلل تلفزيوني محترف.
        `
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.65,
      max_tokens: 3000,
      top_p: 0.9
    });

    const fullText = completion.choices[0].message.content;
    
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
        fullText, // نعرض النص كاملاً بشكل متكامل بدل تقسيمه ضعيف
      },

      aiModel: "groq-llama-3.3-70b",
      processingTime: Date.now() - start,
      isPublished: true
    });

    await analysis.save();

    console.log(`✅ DONE in ${Date.now() - start}ms`);

    return analysis;

  } catch (err) {
    console.error(`❌ AI FAILED → fallback. Reason: ${err.message}`);

    return fallback(matchData);
  }
}


/**
 * NEW — Strong Prompt
 */
function buildPrompt(m) {
  const score = `${m.score?.home || m.scoreA} - ${m.score?.away || m.scoreB}`;

  return `
حلل مباراة كرة القدم التالية بلغة عربية فصحى واضحة واحترافية كما لو كنت محللاً رياضياً يكتب لجمهور عربي:

المباراة: ${m.homeTeam.name} ضد ${m.awayTeam.name}
النتيجة: ${score}
البطولة: ${m.tournament.name}
الملعب: ${m.venue || 'غير محدد'}
التاريخ: ${new Date(m.date).toLocaleDateString('ar-EG')}

اكتب التحليل مُقسماً كالتالي:

1️⃣ ملخص عام للمباراة
2️⃣ تقييم أداء كل فريق:
   - الدفاع
   - الهجوم
   - الوسط
   - الروح والالتزام
3️⃣ التكتيكات:
   - طريقة اللعب
   - نقاط التحول
4️⃣ ثلاثة لاعبين مؤثرين في المباراة وأسباب التأثير
5️⃣ نقاط قوة كل فريق
6️⃣ نقاط ضعف كل فريق
7️⃣ خلاصة فنية

شروط صارمة:
- اللغة العربية فقط
- لا تستخدم الإنجليزية إطلاقاً
- لا تذكر رموز أو IDs
- استخدم كلمات بشرية طبيعية
- تجنب التكرار
- تحليل احترافي واقعي

ابدأ الآن:
`;
}

function fallback(m) {
  const score = `${m.score?.home || 0} - ${m.score?.away || 0}`;

  const txt = `
انتهت مباراة ${m.homeTeam.name} ضد ${m.awayTeam.name} بنتيجة ${score}.
التحليل التفصيلي غير متوفر حالياً وسيتم توليده قريباً.
  `;

  return {
    matchId: getMatchId(m),
    analysis: {
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
