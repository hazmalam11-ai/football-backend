
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const News = require("../models/news");
const NewsComment = require("../models/NewsComment");
const { requireAuth, authorize } = require("../middlewares/auth");

const router = express.Router();

// 🔹 مكان تخزين الصور (uploads/news)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/news");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off" || v === "") return false;
  }
  return false;
}

// ➕ إنشاء خبر (يدعم رفع صورة)
router.post(
  "/",
  requireAuth,
  authorize("admin", "editor"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      const { title, content, category, isFeatured } = req.body;
      if (!title || !content) {
        res.status(400);
        throw new Error("title and content are required");
      }

      const imageUrl = req.file ? `/uploads/news/${req.file.filename}` : null;
      const willBeFeatured = parseBoolean(isFeatured);

      if (willBeFeatured) {
        await News.updateMany({ isFeatured: true }, { $set: { isFeatured: false } });
      }

      const news = await News.create({
        title,
        content,
        category,
        imageUrl,
        author: req.user?.id,
        isFeatured: willBeFeatured,
      });

      res.status(201).json({ message: "News created", news });
    } catch (err) {
      next(err);
    }
  }
);

// 📌 كل الأخبار
router.get("/", async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = q ? { title: { $regex: q, $options: "i" } } : {};
    const news = await News.find(filter)
      .populate("author", "username")
      .sort({ createdAt: -1 });

    const userId = req.user?.id || null;
    
    const newsWithLikesAndComments = await Promise.all(
      news.map(async (item) => {
        const likedByUser = userId ? item.likes.includes(userId) : false;
        const commentsCount = await NewsComment.countDocuments({ news: item._id });
        
        return {
          ...item.toObject(),
          likesCount: item.likes.length,
          likedByUser,
          commentsCount
        };
      })
    );

    res.json(newsWithLikesAndComments);
  } catch (err) {
    next(err);
  }
});

// 🌐 عرض صفحة HTML للخبر (للمشاركة على فيسبوك وواتساب)
router.get("/:id/preview", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id).populate("author", "username");
    if (!item) {
      return res.status(404).send("<h1>News not found</h1>");
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const newsUrl = `${baseUrl}/news/${item._id}`;
    const imageUrl = item.imageUrl ? `${baseUrl}${item.imageUrl}` : `${baseUrl}/default-news-image.jpg`;
    const description = item.content.substring(0, 155).replace(/<[^>]*>/g, ''); // إزالة HTML tags

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Open Graph Tags للفيسبوك وواتساب -->
    <meta property="og:title" content="${item.title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${newsUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Mal3abak - Your Football Stadium">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${item.title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    
    <title>${item.title} | Mal3abak</title>
    
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .news-container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
        }
        .content {
            line-height: 1.8;
            color: #666;
        }
        .author {
            color: #999;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
    
    <!-- إعادة توجيه بعد 3 ثواني للأبلكيشن -->
    <meta http-equiv="refresh" content="3;url=mal3abak://news/${item._id}">
</head>
<body>
    <div class="news-container">
        <h1>${item.title}</h1>
        ${item.imageUrl ? `<img src="${imageUrl}" alt="${item.title}">` : ''}
        <div class="content">${item.content}</div>
        <div class="author">كتبه: ${item.author?.username || 'مجهول'}</div>
    </div>
    
    <script>
        // محاولة فتح التطبيق
        setTimeout(() => {
            window.location.href = "mal3abak://news/${item._id}";
        }, 100);
    </script>
</body>
</html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// 📌 خبر واحد (API)
router.get("/:id", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id).populate("author", "username");
    if (!item) {
      res.status(404);
      throw new Error("News not found");
    }

    const userId = req.user?.id || null;
    const likedByUser = userId ? item.likes.includes(userId) : false;
    const commentsCount = await NewsComment.countDocuments({ news: item._id });
    
    const response = {
      ...item.toObject(),
      likesCount: item.likes.length,
      likedByUser,
      commentsCount
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ✏️ تحديث خبر
router.put(
  "/:id",
  requireAuth,
  authorize("admin", "editor"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      const { title, content, category, isFeatured } = req.body;
      const updateData = { title, content, category };
      if (typeof isFeatured !== "undefined") {
        const willBeFeatured = parseBoolean(isFeatured);
        if (willBeFeatured) {
          await News.updateMany({ _id: { $ne: req.params.id }, isFeatured: true }, { $set: { isFeatured: false } });
        }
        updateData.isFeatured = willBeFeatured;
      }

      if (req.file) {
        updateData.imageUrl = `/uploads/news/${req.file.filename}`;
      }

      const updated = await News.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        res.status(404);
        throw new Error("News not found");
      }
      res.json({ message: "News updated", news: updated });
    } catch (err) {
      next(err);
    }
  }
);

// 🗑️ حذف خبر
router.delete("/:id", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    const deleted = await News.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404);
      throw new Error("News not found");
    }
    res.json({ message: "News deleted" });
  } catch (err) {
    next(err);
  }
});

// 💖 Toggle like on a news article
router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: "News article not found" });
    }

    const userId = req.user.id;
    const likedIndex = news.likes.indexOf(userId);
    let likedByUser = false;

    if (likedIndex === -1) {
      news.likes.push(userId);
      likedByUser = true;
    } else {
      news.likes.splice(likedIndex, 1);
      likedByUser = false;
    }

    await news.save();
    res.json({ likesCount: news.likes.length, likedByUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
