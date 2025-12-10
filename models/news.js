const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    // ✅ المحتوى الأساسي
    title: { 
      type: String, 
      required: true, 
      trim: true, 
      minlength: 3,
      maxlength: 200
    },
    content: { 
      type: String, 
      required: true, 
      trim: true, 
      minlength: 10 
    },
    category: { 
      type: String, 
      default: "Sports",
      enum: ["Sports", "Football", "Basketball", "Tennis", "News", "Other"],
      trim: true
    },
    
    // 🖼️ الصور
    imageUrl: { 
      type: String, 
      default: "" 
    },
    ogImage: { 
      type: String, 
      default: "" 
    },
    
    // 🔍 SEO Fields
    slug: { 
      type: String, 
      trim: true,
      index: true,
      lowercase: true
    },
    metaDescription: { 
      type: String, 
      maxlength: 160,
      trim: true
    },
    keywords: { 
      type: String, 
      trim: true
    },
    
    // 👤 المؤلف
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      index: true
    },
    
    // 📅 التواريخ
    publishedAt: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    
    // ⭐ Featured
    isFeatured: { 
      type: Boolean, 
      default: false,
      index: true
    },
    
    // 💖 الإعجابات
    likes: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    
    // 📊 إحصائيات
    viewsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // 🔗 Google Indexing Status
    indexingStatus: {
      type: String,
      enum: ["pending", "indexed", "failed", "not_submitted"],
      default: "not_submitted"
    },
    lastIndexedAt: {
      type: Date
    },
    indexingAttempts: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// 📊 Virtual للإعجابات
newsSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// 📊 Virtual للتعليقات (optional)
newsSchema.virtual('comments', {
  ref: 'NewsComment',
  localField: '_id',
  foreignField: 'news'
});

newsSchema.virtual('commentsCount', {
  ref: 'NewsComment',
  localField: '_id',
  foreignField: 'news',
  count: true
});

// 🔍 Indexes لتحسين الأداء
newsSchema.index({ createdAt: -1 }); // للفرز بالأحدث
newsSchema.index({ publishedAt: -1 }); // للفرز بتاريخ النشر
newsSchema.index({ isFeatured: 1, createdAt: -1 }); // للأخبار المميزة
newsSchema.index({ category: 1, createdAt: -1 }); // للفلترة حسب الفئة
newsSchema.index({ slug: 1 }, { unique: true, sparse: true }); // slug فريد
newsSchema.index({ title: 'text', content: 'text' }); // البحث النصي

// ⚡ Compound Index للاستعلامات المعقدة
newsSchema.index({ 
  isFeatured: 1, 
  category: 1, 
  publishedAt: -1 
});

// 🎯 Ensure only one featured news at a time
newsSchema.index(
  { isFeatured: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isFeatured: true },
    name: 'unique_featured_news'
  }
);

// 🔒 Pre-save middleware
newsSchema.pre('save', async function(next) {
  // إذا كان الخبر مميز، إزالة featured من الباقي
  if (this.isModified('isFeatured') && this.isFeatured) {
    await mongoose.model('News').updateMany(
      { _id: { $ne: this._id }, isFeatured: true },
      { $set: { isFeatured: false } }
    );
  }
  
  // توليد slug تلقائي إذا لم يكن موجود
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^ء-يa-z0-9s-]/g, "")
      .trim()
      .replace(/s+/g, "-")
      .substring(0, 100);
  }
  
  next();
});

// 📈 Instance Methods
newsSchema.methods.incrementViews = function() {
  this.viewsCount += 1;
  return this.save();
};

newsSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  if (likeIndex === -1) {
    this.likes.push(userId);
  } else {
    this.likes.splice(likeIndex, 1);
  }
  return this.save();
};

newsSchema.methods.markAsIndexed = function() {
  this.indexingStatus = "indexed";
  this.lastIndexedAt = new Date();
  return this.save();
};

newsSchema.methods.markIndexingFailed = function() {
  this.indexingStatus = "failed";
  this.indexingAttempts += 1;
  return this.save();
};

// 📊 Static Methods
newsSchema.statics.getFeaturedNews = function() {
  return this.findOne({ isFeatured: true })
    .populate('author', 'username')
    .lean();
};

newsSchema.statics.getLatestNews = function(limit = 10) {
  return this.find({})
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'username')
    .lean();
};

newsSchema.statics.getNewsByCategory = function(category, limit = 10) {
  return this.find({ category })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'username')
    .lean();
};

newsSchema.statics.searchNews = function(query) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .populate('author', 'username')
  .lean();
};

newsSchema.statics.getPendingIndexing = function() {
  return this.find({
    indexingStatus: { $in: ["pending", "not_submitted", "failed"] },
    indexingAttempts: { $lt: 3 }
  })
  .sort({ createdAt: -1 })
  .limit(50);
};

// 🔄 Query Helpers
newsSchema.query.featured = function() {
  return this.where({ isFeatured: true });
};

newsSchema.query.published = function() {
  return this.where({ publishedAt: { $lte: new Date() } });
};

newsSchema.query.byCategory = function(category) {
  return this.where({ category });
};

newsSchema.query.recent = function(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return this.where({ publishedAt: { $gte: date } });
};

// 🗑️ Cascade delete comments when news is deleted
newsSchema.pre('findOneAndDelete', async function(next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await mongoose.model('NewsComment').deleteMany({ news: doc._id });
  }
  next();
});

newsSchema.pre('deleteOne', { document: true }, async function(next) {
  await mongoose.model('NewsComment').deleteMany({ news: this._id });
  next();
});

// 📝 Export Model
module.exports = mongoose.models.News || mongoose.model("News", newsSchema);
