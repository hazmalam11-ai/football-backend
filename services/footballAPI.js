// services/footballAPI.js
const axios = require("axios");

class FootballAPIService {
  constructor() {
    this.baseURL = "https://v3.football.api-sports.io";
    this.apiKey = process.env.FOOTBALL_API_KEY;

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "x-apisports-key": this.apiKey,
      },
      timeout: 15000,
    });

    console.log("⚙️ Using API KEY:", this.apiKey ? "Loaded ✅" : "❌ Missing");
  }

  // ✅ جلب المباريات المباشرة - Direct from API-Football documentation
  async getLiveMatches() {
    try {
      console.log("🔴 Fetching live matches directly from API-Football...");
      const response = await this.api.get("/fixtures", { 
        params: { 
          live: "all"
        } 
      });
      
      console.log(`📡 API Response: ${response.data.results} live matches found`);
      return response.data.response || [];
    } catch (error) {
      console.error("❌ Error in getLiveMatches:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب مباريات اليوم
  async getTodayMatches(timezone = 'UTC') {
    try {
      // Get today's date in the specified timezone
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      console.log(`📅 Fetching today's matches for ${timezone}: ${todayStr}`);
      const response = await this.api.get("/fixtures", { 
        params: { 
          date: todayStr,
          timezone: timezone
        } 
      });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getTodayMatches:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب مباريات أمس
  async getYesterdayMatches(timezone = 'UTC') {
    try {
      // Get yesterday's date in the specified timezone
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      console.log(`📅 Fetching yesterday's matches for ${timezone}: ${yesterdayStr}`);
      const response = await this.api.get("/fixtures", { 
        params: { 
          date: yesterdayStr,
          timezone: timezone
        } 
      });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getYesterdayMatches:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب مباريات غد
  async getTomorrowMatches(timezone = 'UTC') {
    try {
      // Get tomorrow's date in the specified timezone
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      console.log(`📅 Fetching tomorrow's matches for ${timezone}: ${tomorrowStr}`);
      const response = await this.api.get("/fixtures", { 
        params: { 
          date: tomorrowStr,
          timezone: timezone
        } 
      });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getTomorrowMatches:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب مباريات بين تاريخين
  async getMatchesInRange(fromDate, toDate) {
    try {
      const from = new Date(fromDate).toISOString().split("T")[0];
      const to = new Date(toDate).toISOString().split("T")[0];

      const response = await this.api.get("/fixtures", {
        params: { from, to },
      });

      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getMatchesInRange:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب مباريات بتاريخ محدد - Updated to match HTML template logic
  async getMatchesByDate(date, timezone = 'UTC') {
    try {
      // Format date as YYYY-MM-DD (same as HTML template)
      const dateStr = new Date(date).toISOString().split("T")[0];
      
      console.log(`📅 Fetching matches for date: ${dateStr} (timezone: ${timezone})`);
      
      // Use direct API call like HTML template
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check for API errors (same as HTML template)
      if (data.errors && Object.keys(data.errors).length > 0) {
        throw new Error(data.errors.token || JSON.stringify(data.errors));
      }
      
      console.log(`📡 API Response: ${data.results} matches found for ${dateStr}`);
      return data.response || [];
    } catch (error) {
      console.error("❌ Error in getMatchesByDate:", error.message);
      return [];
    }
  }

  // ✅ جلب مباريات أسبوع فات + أسبوع جاي
  async getMatchesOneWeekRange() {
    try {
      const today = new Date();

      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 7);

      const toDate = new Date(today);
      toDate.setDate(today.getDate() + 7);

      const from = fromDate.toISOString().split("T")[0];
      const to = toDate.toISOString().split("T")[0];

      const response = await this.api.get("/fixtures", {
        params: { from, to },
      });

      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getMatchesOneWeekRange:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ مباراة محددة
  async getMatchById(matchId) {
    try {
      const response = await this.api.get("/fixtures", { params: { id: matchId } });
      return response.data.response[0] || null;
    } catch (error) {
      console.error("❌ Error in getMatchById:", error.response?.data || error.message);
      return null;
    }
  }

  // ✅ آخر مباريات فريق
  async getTeamLastMatches(teamId, count = 5) {
    try {
      const response = await this.api.get("/fixtures", { params: { team: teamId, last: count } });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getTeamLastMatches:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ ترتيب الدوري
  async getStandings(leagueId, season) {
    try {
      const response = await this.api.get("/standings", { params: { league: leagueId, season } });
      return response.data.response[0]?.league?.standings[0] || [];
    } catch (error) {
      console.error("❌ Error in getStandings:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ الدوريات
  async getLeagues(country, season) {
    try {
      const params = {};
      if (country) params.country = country;
      if (season) params.season = season;

      const response = await this.api.get("/leagues", { params });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getLeagues:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ معلومات فريق
  async getTeamInfo(teamId) {
    try {
      const response = await this.api.get("/teams", { params: { id: teamId } });
      return response.data.response[0] || null;
    } catch (error) {
      console.error("❌ Error in getTeamInfo:", error.response?.data || error.message);
      return null;
    }
  }

  // ✅ لاعبي فريق
  async getTeamPlayers(teamId, season) {
    try {
      const response = await this.api.get("/players", { params: { team: teamId, season } });
      return response.data.response;
    } catch (error) {
      console.error("❌ Error in getTeamPlayers:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ إحصائيات المباراة
  async getMatchStatistics(matchId) {
    try {
      console.log(`📊 Fetching statistics for match: ${matchId}`);
      const response = await this.api.get("/fixtures/statistics", { 
        params: { fixture: matchId } 
      });
      
      const responseData = response.data.response || [];
      console.log(`📊 Raw statistics response:`, JSON.stringify(responseData, null, 2));
      
      if (responseData.length < 2) {
        console.log(`⚠️ Not enough teams in statistics response`);
        return {};
      }
      
      const homeTeamStats = responseData[0]?.statistics || [];
      const awayTeamStats = responseData[1]?.statistics || [];
      
      const formattedStats = {};
      
      // Create a map of away team stats for easy lookup
      const awayStatsMap = {};
      awayTeamStats.forEach(stat => {
        awayStatsMap[stat.type] = stat.value;
      });
      
      // Process home team stats and match with away team
      homeTeamStats.forEach(stat => {
        const awayValue = awayStatsMap[stat.type] || 0;
        formattedStats[stat.type] = {
          home: stat.value,
          away: awayValue
        };
      });
      
      console.log(`✅ Formatted statistics:`, JSON.stringify(formattedStats, null, 2));
      return formattedStats;
    } catch (error) {
      console.error("❌ Error in getMatchStatistics:", error.response?.data || error.message);
      return {};
    }
  }

  // ✅ أحداث المباراة
  async getMatchEvents(matchId) {
    try {
      console.log(`⚽ Fetching events for match: ${matchId}`);
      const response = await this.api.get("/fixtures/events", { 
        params: { fixture: matchId } 
      });
      
      const events = response.data.response || [];
      return events.map(event => ({
        time: event.time?.elapsed || 0,
        type: event.type,
        player: event.player?.name || 'Unknown',
        team: event.team?.name || 'Unknown',
        detail: event.detail || ''
      }));
    } catch (error) {
      console.error("❌ Error in getMatchEvents:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ تشكيل المباراة (Lineups)
  async getMatchLineups(matchId) {
    try {
      console.log(`🧩 Fetching lineups for match: ${matchId}`);
      const response = await this.api.get("/fixtures/lineups", {
        params: { fixture: matchId }
      });

      const lineups = response.data.response || [];
      // Format into home/away based on response order and team info
      return lineups.map(item => ({
        team: {
          id: item.team?.id,
          name: item.team?.name,
          logo: item.team?.logo,
        },
        coach: item.coach?.name || 'Unknown',
        formation: item.formation || '',
        startXI: (item.startXI || []).map(p => ({
          id: p.player?.id,
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
          grid: p.player?.grid,
          photo: p.player?.id ? `https://media.api-sports.io/football/players/${p.player.id}.png` : null
        })),
        substitutes: (item.substitutes || []).map(p => ({
          id: p.player?.id,
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
          grid: p.player?.grid,
          photo: p.player?.id ? `https://media.api-sports.io/football/players/${p.player.id}.png` : null
        }))
      }));
    } catch (error) {
      console.error("❌ Error in getMatchLineups:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب هدافي اللاعبين (Top Scorers)
  async getTopScorers(leagueId, season) {
    try {
      console.log(`⚽ Fetching top scorers for league: ${leagueId}, season: ${season}`);
      const response = await this.api.get("/players/topscorers", {
        params: { 
          league: leagueId,
          season: season
        }
      });

      const players = response.data.response || [];
      console.log(`📊 Found ${players.length} top scorers`);
      
      return players.map(player => ({
        id: player.player?.id,
        name: player.player?.name || '',
        age: player.player?.age,
        nationality: player.player?.nationality || '',
        photo: player.player?.id ? `https://media.api-sports.io/football/players/${player.player.id}.png` : null,
        team: {
          id: player.statistics[0]?.team?.id,
          name: player.statistics[0]?.team?.name || '',
          logo: player.statistics[0]?.team?.logo,
          country: player.statistics[0]?.league?.country || ''
        },
        league: {
          id: player.statistics[0]?.league?.id,
          name: player.statistics[0]?.league?.name || '',
          country: player.statistics[0]?.league?.country || '',
          logo: player.statistics[0]?.league?.logo
        },
        season: player.statistics[0]?.league?.season,
        position: player.statistics[0]?.games?.position || '',
        stats: {
          appearances: player.statistics[0]?.games?.appearences || 0,
          goals: player.statistics[0]?.goals?.total || 0,
          assists: player.statistics[0]?.goals?.assists || 0,
          yellowCards: player.statistics[0]?.cards?.yellow || 0,
          redCards: player.statistics[0]?.cards?.red || 0,
          minutes: player.statistics[0]?.games?.minutes || 0
        }
      }));
    } catch (error) {
      console.error("❌ Error in getTopScorers:", error.response?.data || error.message);
      return [];
    }
  }

  // ✅ جلب فرق الدوري (Teams by League)
  async getTeamsByLeague(leagueId, season) {
    try {
      console.log(`⚽ Fetching teams for league: ${leagueId}, season: ${season}`);
      const response = await this.api.get("/teams", {
        params: { 
          league: leagueId,
          season: season
        }
      });

      const teams = response.data.response || [];
      console.log(`📊 Found ${teams.length} teams for league ${leagueId}`);
      
      return teams.map(team => ({
        id: team.team?.id,
        name: team.team?.name || '',
        logo: team.team?.logo,
        country: team.team?.country || '',
        founded: team.team?.founded,
        venue: {
          name: team.venue?.name || '',
          city: team.venue?.city || '',
          capacity: team.venue?.capacity || 0
        }
      }));
    } catch (error) {
      console.error("❌ Error in getTeamsByLeague:", error.response?.data || error.message);
      return [];
    }
  }
}

// Export individual functions for easier use
module.exports = {
  getLiveMatches: () => new FootballAPIService().getLiveMatches(),
  getTodayMatches: (timezone) => new FootballAPIService().getTodayMatches(timezone),
  getYesterdayMatches: (timezone) => new FootballAPIService().getYesterdayMatches(timezone),
  getTomorrowMatches: (timezone) => new FootballAPIService().getTomorrowMatches(timezone),
  getMatchesByDate: (date, timezone) => new FootballAPIService().getMatchesByDate(date, timezone),
  getMatchesInRange: (fromDate, toDate) => new FootballAPIService().getMatchesInRange(fromDate, toDate),
  getMatchesOneWeekRange: () => new FootballAPIService().getMatchesOneWeekRange(),
  getMatchById: (matchId) => new FootballAPIService().getMatchById(matchId),
  getTeamLastMatches: (teamId, count) => new FootballAPIService().getTeamLastMatches(teamId, count),
  getStandings: (leagueId, season) => new FootballAPIService().getStandings(leagueId, season),
  getLeagues: (country, season) => new FootballAPIService().getLeagues(country, season),
  getTeamInfo: (teamId) => new FootballAPIService().getTeamInfo(teamId),
  getTeamPlayers: (teamId, season) => new FootballAPIService().getTeamPlayers(teamId, season),
  getMatchStatistics: (matchId) => new FootballAPIService().getMatchStatistics(matchId),
  getMatchEvents: (matchId) => new FootballAPIService().getMatchEvents(matchId),
  getMatchLineups: (matchId) => new FootballAPIService().getMatchLineups(matchId),
  getTopScorers: (leagueId, season) => new FootballAPIService().getTopScorers(leagueId, season),
  getTeamsByLeague: (leagueId, season) => new FootballAPIService().getTeamsByLeague(leagueId, season)
};