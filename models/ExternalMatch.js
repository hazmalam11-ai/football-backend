const mongoose = require("mongoose");

const ExternalMatchSchema = new mongoose.Schema({
  // External API ID
  apiId: { type: Number, required: true, unique: true },
  
  // Fixture details
  fixture: {
    id: { type: Number, required: true },
    referee: { type: String },
    timezone: { type: String, default: "UTC" },
    date: { type: Date, required: true },
    timestamp: { type: Number },
    periods: {
      first: { type: Number },
      second: { type: Number }
    },
    venue: {
      id: { type: Number },
      name: { type: String, required: true },
      city: { type: String }
    },
    status: {
      long: { type: String, default: "Not Started" },
      short: { type: String, default: "NS" },
      elapsed: { type: Number },
      extra: { type: Number }
    }
  },
  
  // League information
  league: {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    logo: { type: String },
    flag: { type: String },
    season: { type: Number, required: true },
    round: { type: String },
    standings: { type: Boolean, default: false }
  },
  
  // Teams
  teams: {
    home: {
      id: { type: Number, required: true },
      name: { type: String, required: true },
      logo: { type: String, required: true },
      winner: { type: Boolean }
    },
    away: {
      id: { type: Number, required: true },
      name: { type: String, required: true },
      logo: { type: String, required: true },
      winner: { type: Boolean }
    }
  },
  
  // Goals and scores
  goals: {
    home: { type: Number },
    away: { type: Number }
  },
  
  score: {
    halftime: {
      home: { type: Number },
      away: { type: Number }
    },
    fulltime: {
      home: { type: Number },
      away: { type: Number }
    },
    extratime: {
      home: { type: Number },
      away: { type: Number }
    },
    penalty: {
      home: { type: Number },
      away: { type: Number }
    }
  },
  
  // Additional metadata
  matchType: { type: String }, // e.g., "El Clásico"
  season: { type: Number },
  leagueId: { type: Number }
  
}, { timestamps: true });

// Indexes for better performance
ExternalMatchSchema.index({ apiId: 1 });
ExternalMatchSchema.index({ "fixture.date": -1 });
ExternalMatchSchema.index({ "teams.home.id": 1, "teams.away.id": 1 });
ExternalMatchSchema.index({ "league.id": 1 });

// Virtual for formatted date
ExternalMatchSchema.virtual("formattedDate").get(function () {
  return this.fixture.date.toLocaleDateString();
});

// Virtual for formatted time
ExternalMatchSchema.virtual("formattedTime").get(function () {
  return this.fixture.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// Virtual for match title
ExternalMatchSchema.virtual("title").get(function () {
  return `${this.teams.home.name} vs ${this.teams.away.name}`;
});

module.exports = mongoose.models.ExternalMatch || mongoose.model("ExternalMatch", ExternalMatchSchema);
