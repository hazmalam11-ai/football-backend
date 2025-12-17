const Groq = require('groq-sdk');
const Analysis = require('../models/Analysis');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * 🤖 Analyze a match using AI
 * @param {Object} matchData - Match data from API
 * @returns {Promise<Object>} Analysis object
 */
async function analyzeMatch(matchData) {
  const startTime = Date.now();
  
  try {
    console.log(`🎯 Starting AI analysis for: ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}`);
    
    // Check if analysis already exists
    const existingAnalysis = await Analysis.findByMatchId(matchData._id || matchData.apiId);
    if (existingAnalysis) {
      console.log(`✅ Analysis already exists for match ${matchData._id}`);
      return existingAnalysis;
    }
    
    // Prepare match data for AI
    const prompt = buildAnalysisPrompt(matchData);
    
    // Call Groq AI
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'أنت محلل كرة قدم محترف وخبير في التحليل التكتيكي والفني للمباريات. قدم تحليلات دقيقة ومفصلة باللغة العربية.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 3000,
      top_p: 0.9
    });
    
    const analysisText = completion.choices[0].message.content;
    
    // Parse AI response into structured data
    const structuredAnalysis = parseAnalysisText(analysisText);
    
    // Create analysis document
    const analysis = new Analysis({
      matchId: matchData._id || matchData.apiId,
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
        home: matchData.scoreA || 0,
        away: matchData.scoreB || 0
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
        summary: structuredAnalysis.summary,
        performance: structuredAnalysis.performance,
        keyPlayers: structuredAnalysis.keyPlayers,
        tactics: structuredAnalysis.tactics,
        statistics: structuredAnalysis.statistics,
        strengths: structuredAnalysis.strengths,
        weaknesses: structuredAnalysis.weaknesses,
        fullText: analysisText
      },
      aiModel: 'groq-llama-3.1-70b',
      analysisLanguage: 'ar',
      processingTime: Date.now() - startTime,
      isPublished: true
    });
    
    // Save to database
    await analysis.save();
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${processingTime}ms for match ${matchData._id}`);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ AI Analysis Error:', error.message);
    
    // Create fallback analysis if AI fails
    const fallbackAnalysis = createFallbackAnalysis(matchData);
    return fallbackAnalysis;
  }
}

/**
 * 📝 Build analysis prompt for AI
 */
function buildAnalysisPrompt(matchData) {
  const homeTeam = matchData.homeTeam.name;
  const awayTeam = matchData.awayTeam.name;
  const score = `${matchData.scoreA} - ${matchData.scoreB}`;
  const tournament = matchData.tournament.name;
  const date = new Date(matchData.date).toLocaleDateString('ar-EG');
  
  return `
حلل هذه المباراة بشكل احترافي ومفصل:

📊 **معلومات المباراة:**
- الفريق الأول: ${homeTeam}
- الفريق الثاني: ${awayTeam}
- النتيجة النهائية: ${score}
- البطولة: ${tournament}
- التاريخ: ${date}
- الملعب: ${matchData.venue || 'غير محدد'}

📋 **المطلوب:**

1. **ملخص المباراة** (3-4 جمل)
   - أبرز أحداث المباراة
   - مجريات اللقاء
   - الفريق الأفضل

2. **تحليل الأداء**
   - أداء ${homeTeam}: (تقييم من 10 + تفاصيل)
   - أداء ${awayTeam}: (تقييم من 10 + تفاصيل)
   - مقارنة الأداء العام

3. **اللاعبين المؤثرين**
   - أفضل 2-3 لاعبين في المباراة
   - تأثيرهم على النتيجة

4. **التكتيكات**
   - خطة ${homeTeam}
   - خطة ${awayTeam}
   - المقارنة التكتيكية

5. **نقاط القوة والضعف**
   - 3 نقاط قوة لكل فريق
   - 3 نقاط ضعف لكل فريق

6. **الإحصائيات والأرقام**
   - تحليل النتيجة
   - الاستحواذ المتوقع
   - الفرص والهجمات

اكتب التحليل بأسلوب احترافي وواضح باللغة العربية الفصحى.
`;
}

/**
 * 🔍 Parse AI response into structured format
 */
function parseAnalysisText(text) {
  try {
    // Extract sections using keywords
    const sections = {
      summary: extractSection(text, ['ملخص', 'summary']),
      performance: {
        overall: extractSection(text, ['أداء', 'performance', 'تحليل الأداء'])
      },
      keyPlayers: extractSection(text, ['لاعب', 'player', 'المؤثر']),
      tactics: {
        comparison: extractSection(text, ['تكتيك', 'tactic', 'خطة'])
      },
      statistics: extractSection(text, ['إحصائ', 'statistic', 'أرقام']),
      strengths: {
        homeTeam: [],
        awayTeam: []
      },
      weaknesses: {
        homeTeam: [],
        awayTeam: []
      }
    };
    
    return sections;
  } catch (error) {
    console.error('Error parsing analysis:', error);
    return {
      summary: text.substring(0, 500),
      performance: { overall: text },
      keyPlayers: '',
      tactics: { comparison: '' },
      statistics: '',
      strengths: { homeTeam: [], awayTeam: [] },
      weaknesses: { homeTeam: [], awayTeam: [] }
    };
  }
}

/**
 * 📄 Extract section from text
 */
function extractSection(text, keywords) {
  const lines = text.split('\n');
  const relevantLines = lines.filter(line => 
    keywords.some(keyword => line.includes(keyword))
  );
  
  return relevantLines.join('\n').trim() || text.substring(0, 300);
}

/**
 * 🔄 Create fallback analysis if AI fails
 */
function createFallbackAnalysis(matchData) {
  const homeScore = matchData.scoreA || 0;
  const awayScore = matchData.scoreB || 0;
  const winner = homeScore > awayScore ? matchData.homeTeam.name : 
                 awayScore > homeScore ? matchData.awayTeam.name : 'تعادل';
  
  const fallbackText = `
انتهت مباراة ${matchData.homeTeam.name} و${matchData.awayTeam.name} بنتيجة ${homeScore}-${awayScore} في ${matchData.tournament.name}.

${winner !== 'تعادل' ? `حقق ${winner} الفوز` : 'انتهت المباراة بالتعادل'} في مباراة شهدت أداءً جيداً من الفريقين.

كانت المباراة تنافسية بشكل كبير، مع فرص متبادلة للطرفين. أظهر كلا الفريقين رغبة قوية في تحقيق النتيجة الإيجابية.

هذا التحليل تم إنشاؤه تلقائياً. سيتم تحديثه قريباً بتحليل مفصل.
`;

  return {
    matchId: matchData._id,
    analysis: {
      summary: fallbackText,
      fullText: fallbackText
    }
  };
}

/**
 * 📊 Analyze multiple matches
 */
async function analyzeMultipleMatches(matches) {
  const results = [];
  
  for (const match of matches) {
    try {
      const analysis = await analyzeMatch(match);
      results.push({ success: true, matchId: match._id, analysis });
      
      // Wait 2 seconds between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      results.push({ 
        success: false, 
        matchId: match._id, 
        error: error.message 
      });
    }
  }
  
  return results;
}

module.exports = {
  analyzeMatch,
  analyzeMultipleMatches
};
