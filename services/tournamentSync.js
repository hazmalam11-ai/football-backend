// services/tournamentSync.js
const footballAPI = require("./footballAPI");
const Tournament = require("../models/tournament");

const syncTournaments = async (country, season) => {
  try {
    console.log(`⏳ Syncing tournaments for ${country}...`);

    const data = await footballAPI.getLeagues(country, season);

    for (const t of data) {
      await Tournament.findOneAndUpdate(
        { apiId: t.league.id },
        {
          apiId: t.league.id,
          name: t.league.name,
          country: t.country.name,
          season: t.seasons[0]?.year || season,
          logo: t.league.logo,
        },
        { upsert: true, new: true }
      );
    }

    console.log("✅ Tournaments synced successfully!");
  } catch (err) {
    console.error("❌ Error syncing tournaments:", err.message);
  }
};

module.exports = { syncTournaments };