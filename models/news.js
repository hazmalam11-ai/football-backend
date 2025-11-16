const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3 },
    content: { type: String, required: true, trim: true, minlength: 10 },
    imageUrl: { type: String, default: "" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // اختياري
    publishedAt: { type: Date, default: Date.now },
    isFeatured: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who liked this article
  },
  { timestamps: true }
);

// Virtual for likes count
newsSchema.virtual('likesCount', {
  ref: 'User',
  localField: 'likes',
  foreignField: '_id',
  count: true
});

// Ensure virtual fields are serialized
newsSchema.set('toJSON', { virtuals: true });
newsSchema.set('toObject', { virtuals: true });

// Ensure only one featured news item at a time
// Unique index applies only when isFeatured is true
newsSchema.index(
  { isFeatured: 1 },
  { unique: true, partialFilterExpression: { isFeatured: true } }
);

module.exports = mongoose.models.News || mongoose.model("News", newsSchema);