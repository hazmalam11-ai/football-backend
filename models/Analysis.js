const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  // Match Information
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
  
  // Match Details
  tournament: {
    id: Number,
    name: String,
    country: String,
    logo: String
  },
  
  venue: String,
  date: Date,
  status: String,
  
  // AI Analysis Content
  analysis: {
    // ملخص عام
    summary: {
      type: String,
      required: true
    },
    
    // أداء الفريقين
    performance: {
      homeTeam: String,
      awayTeam: String,
      overall: String
    },
    
    // اللاعبين المؤثرين
    keyPlayers: {
      type: String
    },
    
    // التكتيكات
    tactics: {
      homeTeam: String,
      awayTeam: String,
      comparison: String
    },
    
    // الإحصائيات والأرقام
    statistics: {
      type: String
    },
    
    // نقاط القوة والضعف
    strengths: {
      homeTeam: [String],
      awayTeam: [String]
    },
    
    weaknesses: {
      homeTeam: [String],
      awayTeam: [String]
    },
    
    // التحليل الكامل (النص الكامل من AI)
    fullText: {
      type: String,
      required: true
    }
  },
  
  // Metadata
  aiModel: {
    type: String,
    default: 'groq-llama-3.1-70b'
  },
  
  analysisLanguage: {
    type: String,
    default: 'ar'
  },
  
  processingTime: {
    type: Number // milliseconds
  },
  
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

// Indexes for better performance
analysisSchema.index({ createdAt: -1 });
analysisSchema.index({ 'tournament.id': 1 });
analysisSchema.index({ 'homeTeam.id': 1 });
analysisSchema.index({ 'awayTeam.id': 1 });
analysisSchema.index({ date: -1 });

// Virtual for match title
analysisSchema.virtual('matchTitle').get(function() {
  return `${this.homeTeam.name} vs ${this.awayTeam.name}`;
});

// Virtual for score display
analysisSchema.virtual('scoreDisplay').get(function() {
  return `${this.score.home} - ${this.score.away}`;
});

// Static method to find analysis by match ID
analysisSchema.statics.findByMatchId = function(matchId) {
  return this.findOne({ matchId });
};

// Static method to get recent analyses
analysisSchema.statics.getRecent = function(limit = 10) {
  return this.find({ isPublished: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-analysis.fullText'); // Exclude full text for list view
};

// Static method to get analyses by tournament
analysisSchema.statics.getByTournament = function(tournamentId, limit = 20) {
  return this.find({ 
    'tournament.id': tournamentId,
    isPublished: true 
  })
    .sort({ date: -1 })
    .limit(limit);
};

// Static method to get analyses by team
analysisSchema.statics.getByTeam = function(teamId, limit = 10) {
  return this.find({
    $or: [
      { 'homeTeam.id': teamId },
      { 'awayTeam.id': teamId }
    ],
    isPublished: true
  })
    .sort({ date: -1 })
    .limit(limit);
};

// Method to increment views
analysisSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Pre-save hook to ensure data integrity
analysisSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set default processing time if not set
    if (!this.processingTime) {
      this.processingTime = 0;
    }
  }
  next();
});

module.exports = mongoose.model('Analysis', analysisSchema);
