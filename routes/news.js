const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { createCanvas } = require("canvas");
const News = require("../models/news");
const NewsComment = require("../models/NewsComment");
const { requireAuth, authorize } = require("../middlewares/auth");

// ⭐ استدعاء Google Indexing
let indexURL;
try {
  indexURL = require("../google/index");
} catch (err) {
  console.warn("⚠️ Google Indexing not available:", err.message);
  indexURL = async () => {
    console.log("⚠️ Google Indexing disabled");
  };
}

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

// 🔹 توليد Slug من العنوان
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^ء-يa-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 100);
}

// 🔹 استخراج Keywords من العنوان والمحتوى
function extractKeywords(title, content) {
  const stopWords = ["في", "من", "إلى", "على", "عن", "مع", "the", "a", "an", "is", "to", "of", "and", "for"];
  const text = `${title} ${content.replace(/<[^>]*>/g, "")}`;
  const words = text
    .toLowerCase()
    .match(/[ء-يa-z0-9]{3,}/g) || [];
  
  const filtered = words.filter(w => !stopWords.includes(w));
  const frequency = {};
  filtered.forEach(w => frequency[w] = (frequency[w] || 0) + 1);
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(e => e[0])
    .join(", ");
}

// 🔹 توليد Meta Description
function generateMetaDescription(content) {
  const clean = content.replace(/<[^>]*>/g, "").trim();
  return clean.substring(0, 155) + (clean.length > 155 ? "..." : "");
}

// 🎨 توليد OG Image تلقائيًا
async function generateOGImage(title, newsId) {
  try {
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // خلفية متدرجة
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1e3c72");
    gradient.addColorStop(1, "#2a5298");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // شعار أو علامة مائية
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Mal3abak", width - 50, height - 50);

    // إضافة نص العنوان
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // تقسيم النص لعدة أسطر
    const maxWidth = 1000;
    const words = title.split(" ");
    let line = "";
    const lines = [];
    
    words.forEach(word => {
      const testLine = line + word + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== "") {
        lines.push(line.trim());
        line = word + " ";
      } else {
        line = testLine;
      }
    });
    if (line) lines.push(line.trim());
    
    // رسم الأسطر
    const lineHeight = 70;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });

    // حفظ الصورة
    const ogDir = path.join(__dirname, "../uploads/news/og");
    if (!fs.existsSync(ogDir)) {
      fs.mkdirSync(ogDir, { recursive: true });
    }
    
    const filename = `og-${newsId}.png`;
    const filepath = path.join(ogDir, filename);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(filepath, buffer);
    
    return `/uploads/news/og/${filename}`;
  } catch (err) {
    console.error("❌ Error generating OG image:", err);
    return null;
  }
}

// 🔄 Retry Logic مع Exponential Backoff
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const waitTime = delay * Math.pow(2, i);
      console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 📊 تسجيل محاولات الأرشفة
async function logIndexing(newsId, url, status, error = null) {
  try {
    const logDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, "indexing.log");
    const logEntry = {
      timestamp: new Date().toISOString(),
      newsId,
      url,
      status,
      error
    };
    
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
  } catch (err) {
    console.error("❌ Logging error:", err.message);
  }
}

// 📍 Ping Sitemap لـ Google & Bing
async function notifySitemap() {
  if (process.env.ENABLE_SITEMAP_PING !== "true") return;
  
  const sitemapUrl = encodeURIComponent("https://mal3abak.com/sitemap/news.xml");
  
  const endpoints = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/indexnow?url=https://mal3abak.com/sitemap/news.xml&key=${process.env.INDEXNOW_KEY || ""}`
  ];

  for (const endpoint of endpoints) {
    try {
      await axios.get(endpoint, { timeout: 5000 });
      console.log(`✅ Sitemap pinged: ${endpoint.split("?")[0]}`);
    } catch (err) {
      console.log(`⚠️ Sitemap ping failed: ${err.message}`);
    }
  }
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

      // 🔹 توليد SEO Data
      const slug = generateSlug(title);
      const metaDescription = generateMetaDescription(content);
      const keywords = extractKeywords(title, content);
      
      let imageUrl = req.file ? `/uploads/news/${req.file.filename}` : null;
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
        slug,
        metaDescription,
        keywords,
      });

      // 🎨 توليد OG Image إذا لم يتم رفع صورة
      if (!imageUrl) {
        const ogImagePath = await generateOGImage(title, news._id);
        if (ogImagePath) {
          news.ogImage = ogImagePath;
          await news.save();
        }
      } else {
        news.ogImage = imageUrl;
        await news.save();
      }

      // ⭐ أرشفة تلقائية بعد إنشاء الخبر مع Retry
      if (process.env.ENABLE_GOOGLE_INDEXING === "true") {
        const fullUrl = `https://mal3abak.com/news/${news._id}/${slug}`;
        
        retryWithBackoff(async () => {
          await indexURL(fullUrl);
          await logIndexing(news._id, fullUrl, "success");
          console.log(`✅ Indexed: ${fullUrl}`);
        }, 3, 1000).catch(err => {
          logIndexing(news._id, fullUrl, "failed", err.message);
          console.error(`❌ Indexing failed: ${err.message}`);
        });

        // 📍 Ping Sitemap
        setTimeout(() => notifySitemap(), 2000);
      }

      res.status(201).json({ message: "News created", news });
    } catch (err) {
      next(err);
    }
  }
);

// 📌 كل الأخبار
router.get("/", async (req, res, next) => {
  try {
    const { q, category, featured } = req.query;
    const filter = {};
    
    if (q) filter.title = { $regex: q, $options: "i" };
    if (category) filter.category = category;
    if (featured === "true") filter.isFeatured = true;
    
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
          commentsCount,
        };
      })
    );

    res.json(newsWithLikesAndComments);
  } catch (err) {
    next(err);
  }
});

// 🌐 Super SEO Preview Page
router.get("/:id/preview", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id).populate("author", "username");
    if (!item) return res.status(404).send("<h1>News not found</h1>");

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const newsUrl = `${baseUrl}/news/${item._id}/${item.slug || ""}`;
    const imageUrl = item.ogImage 
      ? `${baseUrl}${item.ogImage}` 
      : item.imageUrl 
      ? `${baseUrl}${item.imageUrl}` 
      : `${baseUrl}/default-news-image.jpg`;
    
    const description = item.metaDescription || generateMetaDescription(item.content);
    const keywords = item.keywords || extractKeywords(item.title, item.content);

    // 📋 JSON-LD FULL NEWS SCHEMA
    const jsonLD = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": item.title,
      "description": description,
      "image": {
        "@type": "ImageObject",
        "url": imageUrl,
        "width": 1200,
        "height": 630
      },
      "datePublished": item.createdAt,
      "dateModified": item.updatedAt,
      "author": {
        "@type": "Person",
        "name": item.author?.username || "Mal3abak Team",
        "url": `${baseUrl}/user/${item.author?._id || ""}`
      },
      "publisher": {
        "@type": "Organization",
        "name": "Mal3abak",
        "logo": {
          "@type": "ImageObject",
          "url": `${baseUrl}/logo.png`,
          "width": 200,
          "height": 60
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": newsUrl
      },
      "articleSection": item.category || "Sports",
      "keywords": keywords
    };

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Basic Meta -->
    <title>${item.title} | Mal3abak</title>
    <meta name="description" content="${description}">
    <meta name="keywords" content="${keywords}">
    <link rel="canonical" href="${newsUrl}">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${item.title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${newsUrl}">
    <meta property="og:site_name" content="Mal3abak">
    <meta property="article:published_time" content="${item.createdAt}">
    <meta property="article:modified_time" content="${item.updatedAt}">
    <meta property="article:author" content="${item.author?.username || 'Mal3abak'}">
    <meta property="article:section" content="${item.category || 'Sports'}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${item.title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:site" content="@mal3abak">
    
    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
${JSON.stringify(jsonLD, null, 2)}
    </script>
    
    <meta http-equiv="refresh" content="3;url=mal3abak://news/${item._id}">
    
    <style>
        body {
            font-family: 'Cairo', Arial, sans-serif;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        h1 {
            font-size: 2em;
            margin-bottom: 20px;
        }
        .loader {
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <h1>${item.title}</h1>
    <div class="loader"></div>
    <p>جارٍ التحويل إلى التطبيق...</p>
</body>
</html>
`;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// 📌 خبر واحد (API)
router.get("/:id/:slug?", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id).populate("author", "username");
    if (!item) {
      res.status(404);
      throw new Error("News not found");
    }

    const userId = req.user?.id || null;
    const likedByUser = userId ? item.likes.includes(userId) : false;
    const commentsCount = await NewsComment.countDocuments({ news: item._id });

    res.json({
      ...item.toObject(),
      likesCount: item.likes.length,
      likedByUser,
      commentsCount,
    });
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
      const updateData = {};
      
      if (title) {
        updateData.title = title;
        updateData.slug = generateSlug(title);
      }
      if (content) {
        updateData.content = content;
        updateData.metaDescription = generateMetaDescription(content);
      }
      if (title || content) {
        const currentNews = await News.findById(req.params.id);
        updateData.keywords = extractKeywords(
          title || currentNews.title,
          content || currentNews.content
        );
      }
      if (category) updateData.category = category;

      if (typeof isFeatured !== "undefined") {
        const willBeFeatured = parseBoolean(isFeatured);
        if (willBeFeatured) {
          await News.updateMany(
            { _id: { $ne: req.params.id }, isFeatured: true }, 
            { $set: { isFeatured: false } }
          );
          
          // ⭐ أرشفة عند تعيين Featured
          if (process.env.ENABLE_GOOGLE_INDEXING === "true") {
            const news = await News.findById(req.params.id);
            const fullUrl = `https://mal3abak.com/news/${req.params.id}/${news.slug}`;
            retryWithBackoff(() => indexURL(fullUrl))
              .then(() => console.log(`✅ Featured news indexed: ${fullUrl}`))
              .catch(console.error);
          }
        }
        updateData.isFeatured = willBeFeatured;
      }

      if (req.file) {
        updateData.imageUrl = `/uploads/news/${req.file.filename}`;
        updateData.ogImage = updateData.imageUrl;
      }

      const updated = await News.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        res.status(404);
        throw new Error("News not found");
      }

      // ⭐ أرشفة بعد التعديل
      if (process.env.ENABLE_GOOGLE_INDEXING === "true") {
        const fullUrl = `https://mal3abak.com/news/${updated._id}/${updated.slug}`;
        retryWithBackoff(async () => {
          await indexURL(fullUrl);
          await logIndexing(updated._id, fullUrl, "success (update)");
          console.log(`✅ Updated news indexed: ${fullUrl}`);
        }, 3, 1000).catch(err => {
          logIndexing(updated._id, fullUrl, "failed (update)", err.message);
        });
        
        setTimeout(() => notifySitemap(), 2000);
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
    
    // 📍 إعادة ping للـ sitemap بعد الحذف
    setTimeout(() => notifySitemap(), 2000);
    
    res.json({ message: "News deleted" });
  } catch (err) {
    next(err);
  }
});

// 💖 Toggle like on news
router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news)
      return res.status(404).json({ message: "News article not found" });

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
