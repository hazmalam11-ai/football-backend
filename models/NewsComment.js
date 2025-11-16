const mongoose = require('mongoose');

const NewsCommentSchema = new mongoose.Schema({
  news: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'News', 
    required: true 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  body: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 500
  },
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'NewsComment', 
    default: null // null for top-level comments, ObjectId for replies
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'NewsComment'
  }],
  likes: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  likesCount: { 
    type: Number, 
    default: 0 
  },
  hidden: { 
    type: Boolean, 
    default: false 
  },
  reported: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true 
});

// Index for better query performance
NewsCommentSchema.index({ news: 1, createdAt: -1 });
NewsCommentSchema.index({ parent: 1, createdAt: 1 });
NewsCommentSchema.index({ author: 1 });

// Virtual for reply count
NewsCommentSchema.virtual('repliesCount').get(function() {
  return this.replies.length;
});

// Method to check if user liked the comment
NewsCommentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to toggle like
NewsCommentSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.findIndex(like => like.user.toString() === userId.toString());
  
  if (likeIndex > -1) {
    // User already liked, remove the like
    this.likes.splice(likeIndex, 1);
    this.likesCount = Math.max(0, this.likesCount - 1);
    return false; // Return false to indicate like was removed
  } else {
    // User hasn't liked, add the like
    this.likes.push({ user: userId });
    this.likesCount += 1;
    return true; // Return true to indicate like was added
  }
};

// Pre-save middleware to ensure likesCount matches likes array
NewsCommentSchema.pre('save', function(next) {
  this.likesCount = this.likes.length;
  next();
});

module.exports = mongoose.model('NewsComment', NewsCommentSchema);
