const mongoose = require("mongoose");

const FantasyTeamSchema = new mongoose.Schema(
  {
    // صاحب الفريق
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // اسم الفريق
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // قائمة اللاعبين (11 أساسي + 4 بدلاء = 15 لاعب)
    players: [
      {
        player: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Player", 
          required: true 
        },
        isCaptain: { type: Boolean, default: false },
        isViceCaptain: { type: Boolean, default: false },
        isSubstitute: { type: Boolean, default: false },
        // Match statistics for scoring
        minutesPlayed: { type: Number, default: 0 },
        goals: { type: Number, default: 0 },
        assists: { type: Number, default: 0 },
        cleanSheet: { type: Boolean, default: false },
        goalsConceded: { type: Number, default: 0 },
        yellowCards: { type: Number, default: 0 },
        redCards: { type: Number, default: 0 },
        penaltiesSaved: { type: Number, default: 0 },
        penaltiesMissed: { type: Number, default: 0 },
        // Match reference
        match: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "ExternalMatch" 
        },
      },
    ],

    // ميزانية الفريق
    budget: { 
      type: Number, 
      default: 100 
    },

    // إجمالي النقاط
    totalPoints: { 
      type: Number, 
      default: 0 
    },

    // الجولة الحالية (ربط مع Gameweek)
    currentGameweek: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Gameweek" 
    },

    // سجل النقاط حسب الجولات
    pointsHistory: [
      {
        gameweek: { type: mongoose.Schema.Types.ObjectId, ref: "Gameweek" },
        points: { type: Number, default: 0 },
      },
    ],

    // التحويلات (Transfers)
    transfers: [
      {
        in: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
        out: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
        date: { type: Date, default: Date.now },
      },
    ],

    // ترتيب الفريق (يتحدث بعد كل جولة)
    rank: { 
      type: Number, 
      default: null 
    },

    // نوع الفريق الأساسي
    teamType: {
      type: String,
      enum: ['barcelona', 'real-madrid', 'custom'],
      default: 'custom'
    },

    // التشكيلة التكتيكية
    formation: {
      type: String,
      default: '4-4-2'
    },

    // إعدادات تكتيكية مفصلة
    tacticalSetup: {
      starters: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      substitutes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      lastUpdated: { type: Date, default: Date.now }
    },
  },
  { timestamps: true }
);

module.exports = 
  mongoose.models.FantasyTeam || mongoose.model("FantasyTeam", FantasyTeamSchema);