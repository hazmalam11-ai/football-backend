const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const NewsComment = require("../models/NewsComment");
const News = require("../models/news");
const { requireAuth, authorize, allowOwnerOr, allowOwnerOrRoles } = require("../middlewares/auth");

/* ==========================
   CREATE
   ========================== */

// 🟢 Add a comment to news article
router.post(
  "/",
  requireAuth,
  authorize("user", "editor", "admin"),
  async (req, res, next) => {
    try {
      const { news, body, parent } = req.body;

      if (!news || !body) {
        return res.status(400).json({ 
          message: "news and body are required" 
        });
      }

      // Check if news article exists
      const newsArticle = await News.findById(news);
      if (!newsArticle) {
        return res.status(404).json({ 
          message: "News article not found" 
        });
      }

      // If it's a reply, check if parent comment exists
      if (parent) {
        const parentComment = await NewsComment.findById(parent);
        if (!parentComment) {
          return res.status(404).json({ 
            message: "Parent comment not found" 
          });
        }
      }

      const comment = await NewsComment.create({
        news,
        body: body.trim(),
        author: req.user.id,
        parent: parent || null
      });

      // If it's a reply, add it to parent's replies array
      if (parent) {
        await NewsComment.findByIdAndUpdate(parent, {
          $push: { replies: comment._id }
        });
      }

      const populated = await NewsComment.findById(comment._id)
        .populate("author", "username avatar")
        .populate("news", "title")
        .populate("parent", "author body");

      res.status(201).json({ 
        message: "Comment added successfully", 
        comment: populated 
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================
   READ
   ========================== */

// 📌 Get all comments for a news article (with replies)
router.get("/news/:newsId", async (req, res, next) => {
  try {
    const { newsId } = req.params;
    const { page = 1, limit = 20, includeReplies = true } = req.query;

    const query = { 
      news: newsId, 
      hidden: false,
      parent: null // Only top-level comments
    };

    const comments = await NewsComment.find(query)
      .populate("author", "username avatar")
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'username avatar'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add like information for current user
    const userId = req.user?.id || null;
    const commentsWithLikes = comments.map(comment => ({
      ...comment.toObject(),
      likedByUser: userId ? comment.isLikedBy(userId) : false,
      likesCount: comment.likesCount || comment.likes.length,
      replies: comment.replies ? comment.replies.map(reply => ({
        ...reply.toObject(),
        likedByUser: userId ? reply.isLikedBy(userId) : false,
        likesCount: reply.likesCount || reply.likes.length
      })) : []
    }));

    const total = await NewsComment.countDocuments(query);

    res.json({
      comments: commentsWithLikes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    next(err);
  }
});

// 📌 Get a single comment with its replies
router.get("/:id", async (req, res, next) => {
  try {
    const comment = await NewsComment.findById(req.params.id)
      .populate("author", "username avatar")
      .populate("news", "title")
      .populate("parent", "author body")
      .populate({
        path: "replies",
        populate: {
          path: "author",
          select: "username avatar"
        }
      });

    if (!comment) {
      return res.status(404).json({ 
        message: "Comment not found" 
      });
    }

    const userId = req.user?.id || null;
    const commentWithLikes = {
      ...comment.toObject(),
      likedByUser: userId ? comment.isLikedBy(userId) : false,
      likesCount: comment.likesCount || comment.likes.length,
      replies: comment.replies ? comment.replies.map(reply => ({
        ...reply.toObject(),
        likedByUser: userId ? reply.isLikedBy(userId) : false,
        likesCount: reply.likesCount || reply.likes.length
      })) : []
    };

    res.json(commentWithLikes);
  } catch (err) {
    next(err);
  }
});

/* ==========================
   UPDATE
   ========================== */

// ✏️ Update a comment (owner or admin)
router.put(
  "/:id",
  requireAuth,
  allowOwnerOr(async (req) => {
    const comment = await NewsComment.findById(req.params.id);
    return comment?.author;
  }),
  async (req, res, next) => {
    try {
      const { body } = req.body;

      if (!body || body.trim().length === 0) {
        return res.status(400).json({ 
          message: "Comment body cannot be empty" 
        });
      }

      const updated = await NewsComment.findByIdAndUpdate(
        req.params.id,
        { body: body.trim() },
        { new: true, runValidators: true }
      )
        .populate("author", "username avatar")
        .populate("news", "title")
        .populate("parent", "author body");

      if (!updated) {
        return res.status(404).json({ 
          message: "Comment not found" 
        });
      }

      res.json({ 
        message: "Comment updated successfully", 
        comment: updated 
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================
   DELETE
   ========================== */

// 🗑️ Delete a comment (owner OR moderator/editor/admin)
router.delete(
  "/:id",
  requireAuth,
  allowOwnerOrRoles(async (req) => {
    const comment = await NewsComment.findById(req.params.id);
    return comment?.author;
  }, ["admin", "moderator", "editor"]),
  async (req, res, next) => {
    try {
      const comment = await NewsComment.findById(req.params.id);
      
      if (!comment) {
        return res.status(404).json({ 
          message: "Comment not found" 
        });
      }

      // If it's a top-level comment, also delete all replies
      if (!comment.parent) {
        await NewsComment.deleteMany({ parent: comment._id });
      } else {
        // If it's a reply, remove it from parent's replies array
        await NewsComment.findByIdAndUpdate(comment.parent, {
          $pull: { replies: comment._id }
        });
      }

      await NewsComment.findByIdAndDelete(req.params.id);

      res.json({ 
        message: "Comment deleted successfully" 
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================
   LIKE/UNLIKE
   ========================== */

// ❤️ Toggle like on a comment
router.post(
  "/:id/like",
  requireAuth,
  async (req, res, next) => {
    try {
      const comment = await NewsComment.findById(req.params.id);
      
      if (!comment) {
        return res.status(404).json({ 
          message: "Comment not found" 
        });
      }

      const liked = comment.toggleLike(req.user.id);
      await comment.save();

      res.json({
        message: liked ? "Comment liked" : "Comment unliked",
        likesCount: comment.likesCount,
        likedByUser: liked
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================
   ADMIN FUNCTIONS
   ========================== */

// 👁️ Hide/Show comment (admin only)
router.put(
  "/:id/toggle-visibility",
  requireAuth,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const comment = await NewsComment.findById(req.params.id);
      
      if (!comment) {
        return res.status(404).json({ 
          message: "Comment not found" 
        });
      }

      comment.hidden = !comment.hidden;
      await comment.save();

      res.json({
        message: `Comment ${comment.hidden ? 'hidden' : 'shown'} successfully`,
        comment: {
          id: comment._id,
          hidden: comment.hidden
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// 📊 Get comment statistics for a news article (admin only)
router.get(
  "/news/:newsId/stats",
  requireAuth,
  authorize("admin", "editor"),
  async (req, res, next) => {
    try {
      const { newsId } = req.params;

      const stats = await NewsComment.aggregate([
        { $match: { news: mongoose.Types.ObjectId(newsId) } },
        {
          $group: {
            _id: null,
            totalComments: { $sum: 1 },
            totalLikes: { $sum: "$likesCount" },
            topLevelComments: {
              $sum: { $cond: [{ $eq: ["$parent", null] }, 1, 0] }
            },
            replies: {
              $sum: { $cond: [{ $ne: ["$parent", null] }, 1, 0] }
            }
          }
        }
      ]);

      res.json(stats[0] || {
        totalComments: 0,
        totalLikes: 0,
        topLevelComments: 0,
        replies: 0
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
