const cron = require('node-cron');
const axios = require('axios');
const { analyzeMatch } = require('./aiAnalysis');
const Analysis = require('../models/Analysis');

// Configuration
const ENABLED = process.env.ENABLE_AUTO_ANALYSIS === 'true';
const CHECK_INTERVAL = process.env.ANALYSIS_CHECK_INTERVAL || 10; // minutes
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

/**
 * 🚀 Start the auto-analysis service
 */
function start() {
  if (!ENABLED) {
    console.log('⏸️  Auto-analysis is disabled (ENABLE_AUTO_ANALYSIS=false)');
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is required for auto-analysis');
    return;
  }

  console.log(`🤖 Starting Auto-Analysis Service...`);
  console.log(`⏰ Check interval: Every ${CHECK_INTERVAL} minutes`);
  
  // Run immediately on startup
  setTimeout(() => {
    checkAndAnalyzeMatches();
  }, 10000); // Wait 10 seconds after server starts

  // Schedule cron job
  const cronExpression = `*/${CHECK_INTERVAL} * * * *`;
  cronJob = cron.schedule(cronExpression, () => {
    if (!isRunning) {
      checkAndAnalyzeMatches();
    } else {
      console.log('⏳ Previous analysis still running, skipping...');
    }
  });

  console.log('✅ Auto-Analysis Service started successfully');
}

/**
 * 🛑 Stop the auto-analysis service
 */
function stop() {
  if (cronJob) {
    cronJob.stop();
    console.log('🛑 Auto-Analysis Service stopped');
  }
}

/**
 * 🔍 Check and analyze finished matches
 */
async function checkAndAnalyzeMatches() {
  if (isRunning) {
    console.log('⏳ Analysis already in progress');
    return;
  }

  isRunning = true;
  stats.totalChecks++;
  stats.lastCheck = new Date();

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Checking for finished matches to analyze...');
  console.log('='.repeat(60));

  try {
    // Get today's matches
    const todayMatches = await fetchTodayMatches();
    console.log(`📊 Found ${todayMatches.length} matches today`);

    // Get yesterday's matches (in case we missed any)
    const yesterdayMatches = await fetchYesterdayMatches();
    console.log(`📊 Found ${yesterdayMatches.length} matches yesterday`);

    const allMatches = [...todayMatches, ...yesterdayMatches];

    // Filter finished matches (FT = Full Time)
    const finishedMatches = allMatches.filter(match => 
      match.status === 'FT' || 
      match.status === 'AET' || 
      match.status === 'PEN'
    );

    console.log(`✅ Found ${finishedMatches.length} finished matches`);

    if (finishedMatches.length === 0) {
      console.log('ℹ️  No finished matches to analyze');
      isRunning = false;
      return;
    }

    // Check which matches need analysis
    const matchesToAnalyze = [];
    
    for (const match of finishedMatches) {
      const exists = await Analysis.findByMatchId(match._id || match.apiId);
      
      if (!exists) {
        matchesToAnalyze.push(match);
      }
    }

    console.log(`🎯 Matches requiring analysis: ${matchesToAnalyze.length}`);

    // Analyze matches
    if (matchesToAnalyze.length > 0) {
      for (const match of matchesToAnalyze) {
        try {
          console.log(`\n🤖 Analyzing: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          
          const analysis = await analyzeMatch(match);
          
          if (analysis) {
            stats.matchesAnalyzed++;
            stats.lastAnalysis = new Date();
            console.log(`✅ Analysis saved for: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          }

          // Wait 3 seconds between analyses to avoid rate limits
          await sleep(3000);

        } catch (error) {
          stats.errors++;
          console.error(`❌ Failed to analyze match ${match._id}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Auto-Analysis Statistics:');
    console.log(`   Total Checks: ${stats.totalChecks}`);
    console.log(`   Matches Analyzed: ${stats.matchesAnalyzed}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Last Check: ${stats.lastCheck.toLocaleString('ar-EG')}`);
    if (stats.lastAnalysis) {
      console.log(`   Last Analysis: ${stats.lastAnalysis.toLocaleString('ar-EG')}`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    stats.errors++;
    console.error('❌ Auto-analyze error:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * 📅 Fetch today's matches
 */
async function fetchTodayMatches() {
  try {
    const response = await axios.get(`${API_BASE_URL}/matches/today`, {
      timeout: 10000
    });
    return response.data || [];
  } catch (error) {
    console.error('❌ Error fetching today matches:', error.message);
    return [];
  }
}

/**
 * 📅 Fetch yesterday's matches
 */
async function fetchYesterdayMatches() {
  try {
    const response = await axios.get(`${API_BASE_URL}/matches/yesterday`, {
      timeout: 10000
    });
    return response.data || [];
  } catch (error) {
    console.error('❌ Error fetching yesterday matches:', error.message);
    return [];
  }
}

/**
 * ⏱️ Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 📊 Get service statistics
 */
function getStats() {
  return {
    ...stats,
    isRunning,
    enabled: ENABLED,
    checkInterval: CHECK_INTERVAL
  };
}

/**
 * 🔄 Manual trigger for analysis
 */
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
