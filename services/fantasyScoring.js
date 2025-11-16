// services/fantasyScoring.js
const Match = require("../models/match");
const Player = require("../models/Player");
const FantasyTeam = require("../models/FantasyTeam");
const FantasyPoints = require("../models/FantasyPoints");
const Gameweek = require("../models/Gameweek");

/**
 * ✅ نظام النقاط للفانتازي (مرن وسهل التعديل)
 */
const scoringRules = {
  goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
  save: 1, // لكل 3 تصديات
  penaltySave: 5,
  penaltyMiss: -2,
  yellow: -1,
  red: -3,
  ownGoal: -2,
  minutes: { under60: 1, over60: 2 },
};

/**
 * ✅ حساب النقاط للاعب واحد في مباراة
 */
function calculatePlayerPoints(stats, position) {
  let points = 0;

  // دقائق اللعب
  if (stats.minutes > 0) {
    points += stats.minutes < 60 ? scoringRules.minutes.under60 : scoringRules.minutes.over60;
  }

  // أهداف
  if (stats.goals > 0) {
    points += stats.goals * (scoringRules.goal[position] || 0);
  }

  // أسيست
  if (stats.assists > 0) {
    points += stats.assists * scoringRules.assist;
  }

  // كلين شيت
  if (stats.cleanSheet) {
    points += scoringRules.cleanSheet[position] || 0;
  }

  // تصديات (للحارس)
  if (stats.saves && position === "GK") {
    points += Math.floor(stats.saves / 3) * scoringRules.save;
  }

  // جزائيات
  if (stats.penaltySave) points += scoringRules.penaltySave;
  if (stats.penaltyMiss) points += scoringRules.penaltyMiss;

  // كروت
  if (stats.yellow) points += scoringRules.yellow;
  if (stats.red) points += scoringRules.red;

  // هدف عكسي
  if (stats.ownGoal) points += scoringRules.ownGoal;

  return points;
}

/**
 * ✅ حساب Bonus Points (Top 3 في الماتش)
 */
function calculateBonus(playersStats) {
  // playersStats = [{ playerId, scoreContribution }]
  const sorted = playersStats.sort((a, b) => b.scoreContribution - a.scoreContribution);
  const bonus = {};

  if (sorted[0]) bonus[sorted[0].playerId] = 3;
  if (sorted[1]) bonus[sorted[1].playerId] = 2;
  if (sorted[2]) bonus[sorted[2].playerId] = 1;

  return bonus;
}

/**
 * ✅ تحديث النقاط لكل اللاعبين في الجولة
 */
async function updateGameweekPoints(gameweekId) {
  try {
    console.log(`⏳ Updating Fantasy Points for Gameweek ${gameweekId}...`);

    const gameweek = await Gameweek.findById(gameweekId);
    if (!gameweek) throw new Error("Gameweek not found");

    // كل المباريات في الجولة
    const matches = await Match.find({
      date: { $gte: gameweek.startDate, $lte: gameweek.endDate },
    });

    for (const match of matches) {
      let playersStats = [];

      for (const event of match.events) {
        const player = await Player.findOne({ name: event.player });
        if (!player) continue;

        const position = player.position || "MID";

        // إحصائيات مبسطة (ممكن توسعها من API)
        const stats = {
          minutes: match.minute || 0,
          goals: event.type === "goal" ? 1 : 0,
          assists: event.type === "assist" ? 1 : 0,
          cleanSheet: match.scoreB === 0 || match.scoreA === 0,
          saves: event.type === "save" ? 1 : 0,
          penaltySave: event.type === "penalty-save" ? 1 : 0,
          penaltyMiss: event.type === "penalty-miss" ? 1 : 0,
          yellow: event.cardType === "yellow" ? 1 : 0,
          red: event.cardType === "red" ? 1 : 0,
          ownGoal: event.type === "own-goal" ? 1 : 0,
        };

        const points = calculatePlayerPoints(stats, position);

        playersStats.push({
          playerId: player._id.toString(),
          scoreContribution: points,
        });

        // ✅ خزّن نقاط اللاعب
        await FantasyPoints.findOneAndUpdate(
          { player: player._id, gameweek: gameweek._id },
          { player: player._id, gameweek: gameweek._id, points },
          { upsert: true, new: true }
        );

        // ✅ أضف النقاط للفِرق
        const teams = await FantasyTeam.find({ "players.player": player._id });
        for (const team of teams) {
          let multiplier = 1;
          const playerData = team.players.find((p) => p.player.toString() === player._id.toString());
          if (playerData?.isCaptain) multiplier = team.chip === "TRIPLE_CAPTAIN" ? 3 : 2;
          if (playerData?.isViceCaptain) multiplier = 1.5;

          team.totalPoints += points * multiplier;

          // Bench Boost Chip
          if (team.chip === "BENCH_BOOST" && playerData?.isSubstitute) {
            team.totalPoints += points; // تضيف نقاط البدلاء
          }

          await team.save();
        }
      }

      // ✅ حساب Bonus Points
      const bonus = calculateBonus(playersStats);
      for (const [playerId, bonusPoints] of Object.entries(bonus)) {
        await FantasyPoints.findOneAndUpdate(
          { player: playerId, gameweek: gameweek._id },
          { $inc: { points: bonusPoints } },
          { upsert: true }
        );

        // أضف البونص للفِرق
        const teams = await FantasyTeam.find({ "players.player": playerId });
        for (const team of teams) {
          team.totalPoints += bonusPoints;
          await team.save();
        }
      }
    }

    console.log("✅ Fantasy Points Updated with Bonus & Chips!");
  } catch (err) {
    console.error("❌ Error updating gameweek points:", err.message);
  }
}

module.exports = {
  calculatePlayerPoints,
  updateGameweekPoints,
  scoringRules,
};