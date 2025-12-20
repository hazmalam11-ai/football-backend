const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Teams
  homeTeam: {
    id: Number,
    name: String,
    logo: String
  },

  awayTeam: {
    id: Number,
    name: String,
    logo: String
  },

  // Score
  score: {
    home: { type: Number, default: 0 },
    away: { type: Number, default: 0 }
  },

  // Tournament
  tournament: {
    id: Number,
    name: String,
    country: String,
    logo: String
  },

  venue: String,
  date: Date,
  status: String,

  // AI CONTENT
  analysis: {
    summary: {
      type: String,
      required: true
    },

    performance: {
      homeTeam: String,
      awayTeam: String,
      overall: String
    },

    keyPlayers: String,

    tactics: {
      homeTeam: String,
      awayTeam: String,
      comparison: String
    },

    statistics: String,

    strengths: {
      homeTeam: { type: [String], default: [] },
      awayTeam: { type: [String], default: [] }
    },

    weaknesses: {
      homeTeam: { type: [String], default: [] },
      awayTeam: { type: [String], default: [] }
    },

    // ⚠️ مهم: لم يعد required لأن ده سبب الكراش
    fullText: {
      type: String,
      default: ''
    }
  },

  aiModel: {
    type: String,
    default: 'groq-llama-3.1-70b'
  },

  analysisLanguage: {
    type: String,
    default: 'ar'
  },

  processingTime: Number,

  isPublished: {
    type: Boolean,
    default: true
  },

  views: {
    type: Number,
    default: 0
  },

  likes: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
analysisSchema.index({ createdAt: -1 });
analysisSchema.index({ 'tournament.id': 1 });
analysisSchema.index({ 'homeTeam.id': 1 });
analysisSchema.index({ 'awayTeam.id': 1 });
analysisSchema.index({ date: -1 });

analysisSchema.virtual('matchTitle').get(function() {
  return `${this.homeTeam?.name || ''} vs ${this.awayTeam?.name || ''}`;
});

analysisSchema.virtual('scoreDisplay').get(function() {
  return `${this.score?.home || 0} - ${this.score?.away || 0}`;
});

// Static find
analysisSchema.statics.findByMatchId = function(matchId) {
  return this.findOne({ matchId });
};

module.exports = mongoose.model('Analysis', analysisSchema);
