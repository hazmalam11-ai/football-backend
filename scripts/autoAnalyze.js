const cron = require('node-cron');
const axios = require('axios');
const { analyzeMatch } = require('./aiAnalysis');
const Analysis = require('../models/Analysis');

const ENABLED = process.env.ENABLE_AUTO_ANALYSIS === 'true';
const CHECK_INTERVAL = Number(process.env.ANALYSIS_CHECK_INTERVAL || 10);
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.mal3abak.com';

let isRunning = false;
let cronJob = null;

let stats = {
  totalChecks: 0,
  matchesAnalyzed: 0,
  lastCheck: null,
  lastAnalysis: null,
  errors: 0
};

function getMatchId(match) {
  return match.apiId || match._id || match.fixture?.id;
}

function isMatchFinished(match) {
  const status = match.status || match.fixture?.status?.short;

  return ['FT', 'AET', 'PEN'].includes(
    (status || '').toString().toUpperCase()
  );
}

async function fetchTodayMatches() {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/matches/today`, {
      timeout: 15000
    });
    return res.data || [];
  } catch (e) {
    console.error('❌ Error fetching today matches:', e.message);
    return [];
  }
}

async function fetchYesterdayMatches() {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/matches/yesterday`, {
      timeout: 15000
    });
    return res.data || [];
  } catch (e) {
    console.error('❌ Error fetching yesterday matches:', e.message);
    return [];
  }
}

async function checkAndAnalyzeMatches() {
  if (isRunning) {
    console.log('⏳ Previous analysis still running, skipping…');
    return;
  }

  isRunning = true;
  stats.totalChecks++;
  stats.lastCheck = new Date();

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Checking finished matches for analysis…');
  console.log('='.repeat(60));

  try {
    const today = await fetchTodayMatches();
    const yesterday = await fetchYesterdayMatches();
    const matches = [...today, ...yesterday];

    const finished = matches.filter(m => isMatchFinished(m));
    console.log(`📊 Finished matches found: ${finished.length}`);

    const toAnalyze = [];

    for (const m of finished) {
      const id = getMatchId(m);

      if (!id) continue;

      const exists = await Analysis.findByMatchId(id);

      if (!exists) toAnalyze.push(m);
    }

    console.log(`🎯 Matches needing analysis: ${toAnalyze.length}`);

    for (const match of toAnalyze) {
      try {
        const id = getMatchId(match);

        if (!id) {
          console.warn('⚠️ Match missing ID, skipping');
          continue;
        }

        console.log(`🤖 Analyzing: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`);

        // Perform AI analysis
        const result = await analyzeMatch({
          ...match,
          matchId: id
        });

        if (result) {
          stats.matchesAnalyzed++;
          stats.lastAnalysis = new Date();
        }

        await new Promise(r => setTimeout(r, 3000));

      } catch (e) {
        console.error('❌ Failed analyzing match:', e.message);
        stats.errors++;
      }
    }

  } catch (err) {
    console.error('❌ Auto-analysis error:', err.message);
    stats.errors++;
  }

  console.log('='.repeat(60));
  console.log(`✔ Stats — Checks: ${stats.totalChecks}, Analyzed: ${stats.matchesAnalyzed}, Errors: ${stats.errors}`);
  console.log('='.repeat(60));

  isRunning = false;
}

function start() {
  if (!ENABLED) {
    console.log('⏸️ Auto-analysis disabled ENABLE_AUTO_ANALYSIS=false');
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.log('❌ Missing GROQ_API_KEY');
    return;
  }

  console.log('🤖 Starting auto-analysis service…');
  console.log(`⏰ Interval: ${CHECK_INTERVAL} min`);

  setTimeout(checkAndAnalyzeMatches, 8000);

  cronJob = cron.schedule(`*/${CHECK_INTERVAL} * * * *`, checkAndAnalyzeMatches);

  console.log('✅ Auto-analysis started');
}

function stop() {
  if (cronJob) {
    cronJob.stop();
    console.log('🛑 Auto-analysis stopped');
  }
}

function getStats() {
  return {
    ...stats,
    enabled: ENABLED,
    interval: CHECK_INTERVAL,
    isRunning
  };
}

async function triggerManualAnalysis() {
  console.log('🔄 Manual analysis triggered');
  return checkAndAnalyzeMatches();
}

module.exports = {
  start,
  stop,
  getStats,
  triggerManualAnalysis,
  checkAndAnalyzeMatches
};
