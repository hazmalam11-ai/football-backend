// services/matchSync.js
const footballAPI = require("./footballAPI");
const Match = require("../models/match");
const Team = require("../models/Team");
const Tournament = require("../models/tournament");
const { syncPlayers } = require("./playerSync"); // ✅ استدعاء مزامنة اللاعبين

/**
 * ✅ مزامنة المباريات في فترة زمنية (افتراضي: أسبوع فات + أسبوع جاي)
 */
const syncMatchesInRange = async (daysBack = 7, daysForward = 7) => {
  try {
    console.log(`⏳ Syncing matches from last ${daysBack} days to next ${daysForward} days...`);

    const today = new Date();
    const past = new Date(today);
    past.setDate(today.getDate() - daysBack);
    const future = new Date(today);
    future.setDate(today.getDate() + daysForward);

    // 🟢 صيغة التاريخ YYYY-MM-DD
    const fromDate = past.toISOString().split("T")[0];
    const toDate = future.toISOString().split("T")[0];

    // 🟢 استخدم footballAPI مع تاريخ من-إلى
    const apiMatches = await footballAPI.getMatchesInRange(fromDate, toDate);

    console.log("📥 API Matches Response:", apiMatches?.length || 0);

    if (!apiMatches || apiMatches.length === 0) {
      console.log("⚠️ No matches found in this range from API");
      return;
    }

    for (const m of apiMatches) {
      // ✅ تحقق من الفريقين
      const homeTeam = await Team.findOneAndUpdate(
        { apiId: m.teams.home.id },
        {
          apiId: m.teams.home.id,
          name: m.teams.home.name,
          logo: m.teams.home.logo,
          country: m.teams.home.country,
        },
        { upsert: true, new: true }
      );

      const awayTeam = await Team.findOneAndUpdate(
        { apiId: m.teams.away.id },
        {
          apiId: m.teams.away.id,
          name: m.teams.away.name,
          logo: m.teams.away.logo,
          country: m.teams.away.country,
        },
        { upsert: true, new: true }
      );

      // ✅ تحقق من البطولة
      const tournament = await Tournament.findOneAndUpdate(
        { apiId: m.league.id },
        {
          apiId: m.league.id,
          name: m.league.name,
          country: m.league.country,
          season: m.league.season,
        },
        { upsert: true, new: true }
      );

      // ✅ حفظ أو تحديث المباراة
      await Match.findOneAndUpdate(
        { apiId: m.fixture.id },
        {
          apiId: m.fixture.id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          tournament: tournament._id,
          scoreA: m.goals.home ?? 0,
          scoreB: m.goals.away ?? 0,
          date: new Date(m.fixture.date),
          venue: m.fixture.venue?.name || "Unknown",
          status: m.fixture.status.short === "LIVE" ? "live" : m.fixture.status.short,
          minute: m.fixture.status.elapsed || 0,
        },
        { upsert: true, new: true }
      );

      // ✅ جلب لاعيبة الفريقين أوتوماتيك
      const season = m.league.season;
      await syncPlayers(m.teams.home.id, season);
      await syncPlayers(m.teams.away.id, season);
    }

    console.log("✅ Matches + Players synced successfully!");
  } catch (err) {
    console.error("❌ Error syncing matches:", err.message);
  }
};

/**
 * ✅ مزامنة المباريات المباشرة (Live)
 */
const syncLiveMatches = async () => {
  try {
    console.log("⏳ Syncing live matches...");

    const apiMatches = await footballAPI.getLiveMatches();
    console.log("📥 API Live Matches Response:", apiMatches?.length || 0);

    if (!apiMatches || apiMatches.length === 0) {
      console.log("⚠️ No live matches found from API");
      return;
    }

    for (const m of apiMatches) {
      await Match.findOneAndUpdate(
        { apiId: m.fixture.id },
        {
          scoreA: m.goals.home ?? 0,
          scoreB: m.goals.away ?? 0,
          status: "live",
          minute: m.fixture.status.elapsed || 0,
        },
        { new: true }
      );
    }

    console.log("✅ Live matches updated!");
  } catch (err) {
    console.error("❌ Error syncing live matches:", err.message);
  }
};

module.exports = { syncMatchesInRange, syncLiveMatches };