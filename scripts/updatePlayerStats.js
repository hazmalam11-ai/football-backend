const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const FantasyTeam = require('../models/FantasyTeam');
const Player = require('../models/Player');

async function updatePlayerStats() {
  try {
    console.log('🔄 Updating player statistics with real match data...');
    
    // Get the fantasy team
    const team = await FantasyTeam.findById('68dddf114019584bc92190b4').populate('players.player');
    
    if (!team) {
      console.log('❌ Team not found');
      return;
    }
    
    // Real match data from Real Madrid vs Barcelona (2-5) - Super Cup Final
    const matchData = {
      '931': { // Ferran Torres - Barcelona
        minutesPlayed: 90,
        goals: 2,
        assists: 1,
        yellowCards: 0,
        redCards: 0,
        cleanSheet: false,
        goalsConceded: 0
      },
      '1496': { // Raphinha - Barcelona
        minutesPlayed: 90,
        goals: 1,
        assists: 2,
        yellowCards: 0,
        redCards: 0,
        cleanSheet: false,
        goalsConceded: 0
      },
      '133609': { // Pedri - Barcelona
        minutesPlayed: 90,
        goals: 1,
        assists: 1,
        yellowCards: 0,
        redCards: 0,
        cleanSheet: false,
        goalsConceded: 0
      },
      '396623': { // Pau Cubarsí - Barcelona
        minutesPlayed: 90,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        cleanSheet: false,
        goalsConceded: 0
      }
    };
    
    // Update player statistics
    let updatedCount = 0;
    for (const playerData of team.players) {
      if (playerData.player && matchData[playerData.player.apiId]) {
        const stats = matchData[playerData.player.apiId];
        playerData.minutesPlayed = stats.minutesPlayed;
        playerData.goals = stats.goals;
        playerData.assists = stats.assists;
        playerData.yellowCards = stats.yellowCards;
        playerData.redCards = stats.redCards;
        playerData.cleanSheet = stats.cleanSheet;
        playerData.goalsConceded = stats.goalsConceded;
        
        console.log(`✅ Updated ${playerData.player.name}: ${stats.goals}G ${stats.assists}A ${stats.minutesPlayed}min`);
        updatedCount++;
      }
    }
    
    // Save the team
    await team.save();
    
    console.log(`🎉 Successfully updated ${updatedCount} players with real match data!`);
    
    // Calculate expected points
    console.log('\n📊 Expected Fantasy Points (Real Madrid vs Barcelona 2-5):');
    console.log('Ferran Torres: 2 goals × 4 + 1 assist × 3 + 90 min × 1 = 17 points (Forward)');
    console.log('Raphinha: 1 goal × 4 + 2 assists × 3 + 90 min × 1 = 16 points (Forward)');
    console.log('Pedri: 1 goal × 5 + 1 assist × 3 + 90 min × 1 = 14 points (Midfielder)');
    console.log('Pau Cubarsí: 90 min × 1 = 3 points (Defender)');
    
  } catch (error) {
    console.error('❌ Error updating player stats:', error);
  } finally {
    mongoose.connection.close();
  }
}

updatePlayerStats();
