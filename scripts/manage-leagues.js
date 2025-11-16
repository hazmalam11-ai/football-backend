#!/usr/bin/env node

// League Management Script
// Usage: node scripts/manage-leagues.js [command] [options]

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config/leagues-config.json');

// Available commands
const commands = {
  'list': () => {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      console.log('📋 Current Allowed Leagues:');
      console.log('========================');
      Object.values(config.allowedLeagues).forEach((league, index) => {
        console.log(`${index + 1}. ${league.name} (ID: ${league.id}) - ${league.country} - Priority: ${league.priority}`);
      });
      console.log(`\nTotal: ${Object.keys(config.allowedLeagues).length} leagues`);
      console.log(`Last updated: ${config.lastUpdated}`);
    } catch (error) {
      console.error('❌ Error reading configuration:', error.message);
    }
  },
  
  'add': (leagueId, name, country) => {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const newPriority = Object.keys(config.allowedLeagues).length + 1;
      
      config.allowedLeagues[`league_${leagueId}`] = {
        id: parseInt(leagueId),
        name: name || `League ${leagueId}`,
        country: country || 'Unknown',
        priority: newPriority
      };
      
      config.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(`✅ Added league: ${name || `League ${leagueId}`} (ID: ${leagueId})`);
    } catch (error) {
      console.error('❌ Error adding league:', error.message);
    }
  },
  
  'remove': (leagueId) => {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const key = `league_${leagueId}`;
      
      if (config.allowedLeagues[key]) {
        delete config.allowedLeagues[key];
        config.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(`✅ Removed league with ID: ${leagueId}`);
      } else {
        console.log(`⚠️ League with ID ${leagueId} not found`);
      }
    } catch (error) {
      console.error('❌ Error removing league:', error.message);
    }
  },
  
  'reset': () => {
    try {
      const defaultConfig = {
        allowedLeagues: {
          la_liga: {
            id: 140,
            name: "La Liga",
            country: "Spain",
            priority: 1
          }
        },
        lastUpdated: new Date().toISOString(),
        version: "1.0"
      };
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
      console.log('✅ Reset to default configuration (La Liga only)');
    } catch (error) {
      console.error('❌ Error resetting configuration:', error.message);
    }
  },
  
  'help': () => {
    console.log('🏆 League Management Script');
    console.log('==========================');
    console.log('Commands:');
    console.log('  list                    - Show current allowed leagues');
    console.log('  add <id> <name> <country> - Add a new league');
    console.log('  remove <id>             - Remove a league by ID');
    console.log('  reset                   - Reset to default (La Liga only)');
    console.log('  help                    - Show this help');
    console.log('\nExamples:');
    console.log('  node scripts/manage-leagues.js list');
    console.log('  node scripts/manage-leagues.js add 39 "Premier League" "England"');
    console.log('  node scripts/manage-leagues.js remove 39');
    console.log('  node scripts/manage-leagues.js reset');
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (!command || !commands[command]) {
  commands.help();
  process.exit(1);
}

// Execute command
if (command === 'add') {
  commands.add(args[1], args[2], args[3]);
} else if (command === 'remove') {
  commands.remove(args[1]);
} else {
  commands[command]();
}
