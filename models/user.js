const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      default: "",
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true, // ✅ ماينفعش يتكرر
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // ✅ ماينفعش يتكرر
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "editor", "user"],
      default: "user",
    },
    country: {
      type: String,
      default: "",
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    favoriteTeams: [{
      teamId: {
        type: Number,
        required: true,
      },
      teamName: {
        type: String,
        required: true,
      },
      teamLogo: {
        type: String,
        default: "",
      },
      leagueName: {
        type: String,
        required: true,
      },
      leagueId: {
        type: Number,
        required: true,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    favoritePlayers: [{
      playerId: {
        type: Number,
        required: true,
      },
      playerName: {
        type: String,
        required: true,
      },
      playerPhoto: {
        type: String,
        default: "",
      },
      position: {
        type: String,
        default: "",
      },
      team: {
        name: { type: String, required: true },
        logo: { type: String, default: "" },
      },
      leagueName: {
        type: String,
        required: true,
      },
      leagueId: {
        type: Number,
        required: true,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);