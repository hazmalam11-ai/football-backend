const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const analyzeMatch = require('../services/aiAnalysis');

// Get analysis for specific match
router.get('/:matchId', async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ matchId: req.params.matchId });
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all analyses
router.get('/', async (req, res) => {
  try {
    const analyses = await Analysis.find().sort({ createdAt: -1 }).limit(20);
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

#### **`models/Analysis.js`** - Database Model
```javascript
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true },
  homeTeam: String,
  awayTeam: String,
  score: String,
  tournament: String,
  date: Date,
  analysis: {
    summary: String,
    performance: String,
    keyPlayers: String,
    tactics: String,
    statistics: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Analysis', analysisSchema);
```

---

#### **`services/aiAnalysis.js`** - AI Service
```javascript
const Groq = require('groq-sdk');
const Analysis = require('../models/Analysis');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY // Get free key from console.groq.com
});

async function analyzeMatch(matchData) {
  try {
    const prompt = `
أنت محلل كرة قدم محترف. حلل هذه المباراة بالتفصيل:

الفريق الأول: ${matchData.homeTeam.name}
الفريق الثاني: ${matchData.awayTeam.name}
النتيجة: ${matchData.scoreA} - ${matchData.scoreB}
البطولة: ${matchData.tournament.name}
التاريخ: ${matchData.date}

قدم تحليل شامل يتضمن:
1. ملخص المباراة
2. أداء الفريقين
3. اللاعبين المؤثرين
4. التكتيكات المستخدمة
5. الإحصائيات الرئيسية
`;

    const completion = await groq.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  max_tokens: 2000
});

    const analysisText = completion.choices[0].message.content;

    // Save to database
    const analysis = new Analysis({
      matchId: matchData._id,
      homeTeam: matchData.homeTeam.name,
      awayTeam: matchData.awayTeam.name,
      score: `${matchData.scoreA} - ${matchData.scoreB}`,
      tournament: matchData.tournament.name,
      date: matchData.date,
      analysis: {
        summary: analysisText,
        performance: extractSection(analysisText, 'أداء'),
        keyPlayers: extractSection(analysisText, 'اللاعبين'),
        tactics: extractSection(analysisText, 'التكتيكات'),
        statistics: extractSection(analysisText, 'الإحصائيات')
      }
    });

    await analysis.save();
    console.log(`✅ Analysis saved for match ${matchData._id}`);
    return analysis;

  } catch (error) {
    console.error('❌ AI Analysis Error:', error);
    throw error;
  }
}

function extractSection(text, keyword) {
  // Extract specific section from analysis
  const lines = text.split('\n');
  return lines.find(line => line.includes(keyword)) || '';
}

module.exports = analyzeMatch;
```

---

#### **`scripts/autoAnalyze.js`** - Cron Job
```javascript
const cron = require('node-cron');
const axios = require('axios');
const analyzeMatch = require('../services/aiAnalysis');
const Analysis = require('../models/Analysis');

// Run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('🔍 Checking for finished matches...');

  try {
    // Get today's matches from your API
    const response = await axios.get('https://api.mal3abak.com/matches/today');
    const matches = response.data;

    for (const match of matches) {
      // Check if match is finished (FT) and not analyzed yet
      if (match.status === 'FT') {
        const exists = await Analysis.findOne({ matchId: match._id });
        
        if (!exists) {
          console.log(`🎯 Analyzing match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          await analyzeMatch(match);
          
          // Wait 2 seconds between analyses (to avoid rate limits)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

  } catch (error) {
    console.error('❌ Auto-analyze error:', error);
  }
});

console.log('✅ Auto-analysis service started');
