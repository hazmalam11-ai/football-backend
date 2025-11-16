const mongoose = require("mongoose");

const GameweekSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true }, // رقم الجولة (1,2,3...)
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // المباريات المرتبطة بالجولة
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }],
    externalMatches: [{ type: mongoose.Schema.Types.ObjectId, ref: "ExternalMatch" }], // External matches from API

    // حالة الجولة
    isActive: { type: Boolean, default: false },   // الجولة الحالية
    isFinished: { type: Boolean, default: false }, // الجولة انتهت

    // ✅ مزايا إضافية للفانتازي
    totalPlayers: { type: Number, default: 0 },     // عدد اللاعبين المشاركين في الجولة
    averagePoints: { type: Number, default: 0 },    // متوسط النقاط لكل لاعب
    highestPoints: { type: Number, default: 0 },    // أعلى نقاط لاعب
    mostPickedPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player" }, // الأكثر اختيارًا
    mostCaptainedPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player" }, // الأكثر كابتنة
    mostTransferredIn: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },  // الأكثر دخولًا
    mostTransferredOut: { type: mongoose.Schema.Types.ObjectId, ref: "Player" }, // الأكثر خروجًا
  },
  { timestamps: true }
);

module.exports = mongoose.models.Gameweek || mongoose.model("Gameweek", GameweekSchema);