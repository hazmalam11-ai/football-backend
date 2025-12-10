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
let requestIndexing;
try {
  const indexModule = require("../google/index");
  requestIndexing = indexModule.requestIndexing || indexModule.indexURL || indexModule;
  console.log("🔥 Google Indexing Loaded Successfully");
} catch (err) {
  console.warn("⚠️ Google Indexing not available:", err.message);
  requestIndexing = async () => {
    console.log("⚠️ Google Indexing disabled");
    return false;
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
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
    }
  }
});

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

// 🔹 توليد Slug من العنوان - مع حماية كاملة
function generateSlug(title) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    console.warn('⚠️ generateSlug received invalid title:', title);
    return `untitled-${Date.now()}`;
  }
  
  return title
    .toLowerCase()
    .trim()
    .replace(/[^ء-يa-z0-9s-]/g, "")
    .replace(/s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

// 🔹 استخراج Keywords من العنوان والمحتوى - Enhanced
function extractKeywords(title, content) {
  const stopWords = [
    "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي",
    "the", "a", "an", "is", "to", "of", "and", "for", "in", "on", "at", "by", "with"
  ];
  
  const text = `${title} ${content.replace(/<[^>]*>/g, "")}`;
  const words = text
    .toLowerCase()
    .match(/[ء-يa-z0-9]{3,}/g) || [];
  
  const filtered = words.filter(w => !stopWords.includes(w));
  const frequency = {};
  filtered.forEach(w => {
    frequency[w] = (frequency[w] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(e => e[0])
    .join(", ");
}

// 🔹 توليد Meta Description - Enhanced
function generateMetaDescription(content, title = "") {
  const clean = content.replace(/<[^>]*>/g, "").trim();
  
  if (clean.length <= 155) {
    return clean;
  }
  
  // Try to cut at sentence end
  const cutPoint = clean.substring(0, 152).lastIndexOf(".");
  if (cutPoint > 100) {
    return clean.substring(0, cutPoint + 1);
  }
  
  return clean.substring(0, 152) + "...";
}

// 🎨 توليد OG Image تلقائيًا - Enhanced with Better Design
async function generateOGImage(title, newsId, category = "Sports") {
  if (!process.env.ENABLE_AUTO_OG_IMAGE || process.env.ENABLE_AUTO_OG_IMAGE !== "true") {
    return null;
  }

  try {
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // خلفية متدرجة حسب الفئة
    const gradients = {
      Football: ["#1e3c72", "#2a5298"],
      Basketball: ["#ff6b6b", "#ee5a6f"],
      Tennis: ["#56ab2f", "#a8e063"],
      Sports: ["#667eea", "#764ba2"],
      News: ["#fc4a1a", "#f7b733"]
    };
    
    const colors = gradients[category] || gradients.Sports;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Pattern overlay
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let i = 0; i < width; i += 50) {
      for (let j = 0; j < height; j += 50) {
        ctx.fillRect(i, j, 25, 25);
      }
    }

    // شعار الموقع
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "left";
    ctx.fillText("⚽ Mal3abak", 50, 70);

    // Category badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(50, 100, 150, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(category, 70, 127);

    // إضافة نص العنوان
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Arial";
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
    
    // رسم الأسطر مع shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    const lineHeight = 70;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2 + 30;
    lines.forEach((l, i) => {
      ctx.fillText(l, width / 2, startY + i * lineHeight);
    });
    
    ctx.shadowColor = "transparent";

    // Footer with date
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "20px Arial";
    ctx.textAlign = "right";
    const date = new Date().toLocaleDateString('ar-EG', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    ctx.fillText(date, width - 50, height - 40);

    // حفظ الصورة
    const ogDir = path.join(__dirname, "../uploads/news/og");
    if (!fs.existsSync(ogDir)) {
      fs.mkdirSync(ogDir, { recursive: true });
    }
    
    const filename = `og-${newsId}.png`;
    const filepath = path.join(ogDir, filename);
    const buffer = canvas.toBuffer("image/png", {
      compressionLevel: parseInt(process.env.OG_IMAGE_QUALITY) || 9
    });
    fs.writeFileSync(filepath, buffer);
    
    console.log(`✅ OG Image generated: ${filename}`);
    return `/uploads/news/og/${filename}`;
  } catch (err) {
    console.error("❌ Error generating OG image:", err);
    return null;
  }
}

// 🔄 Retry Logic مع Exponential Backoff - Enhanced
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000, context = "operation") {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) {
        console.error(`❌ ${context} failed after ${maxRetries} attempts:`, err.message);
        throw err;
      }
      const waitTime = delay * Math.pow(2, i);
      console.log(`⏳ ${context} retry ${i + 1}/${maxRetries} after ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 📊 تسجيل محاولات الأرشفة - Enhanced
async function logIndexing(newsId, url, status, error = null, metadata = {}) {
  if (process.env.ENABLE_INDEXING_LOGS !== "true") return;
  
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
      error: error ? String(error) : null,
      ...metadata
    };
    
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "
");
  } catch (err) {
    console.error("❌ Logging error:", err.message);
  }
}

// 📍 Ping Sitemap لـ Google & Bing - Enhanced
async function notifySitemap() {
  if (process.env.ENABLE_SITEMAP_PING !== "true") return;
  
  const baseUrl = process.env.BASE_URL || "https://mal3abak.com";
  const sitemapUrl = encodeURIComponent(`${baseUrl}/sitemaps/news.xml`);
  
  const endpoints = [
    {
      name: "Google",
      url: `https://www.google.com/ping?sitemap=${sitemapUrl}`
    },
    {
      name: "Bing IndexNow",
      url: `https://www.bing.com/indexnow?url=${baseUrl}/sitemaps/news.xml&key=${process.env.INDEXNOW_KEY || ""}`
    }
  ];

  for (const endpoint of endpoints) {
    try {
      await axios.get(endpoint.url, { timeout: 5000 });
      console.log(`✅ Sitemap pinged: ${endpoint.name}`);
    } catch (err) {
      console.log(`⚠️ ${endpoint.name} ping failed: ${err.message}`);
    }
  }
}

// 🌐 Generate Full URL
function generateNewsUrl(newsId, slug) {
  const baseUrl = process.env.BASE_URL || "https://mal3abak.com";
  return `${baseUrl}/news/${newsId}/${slug || ''}`;
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

      if (title.length < 3 || title.length > 200) {
        res.status(400);
        throw new Error("title must be between 3 and 200 characters");
      }

      if (content.length < 10) {
        res.status(400);
        throw new Error("content must be at least 10 characters");
      }

      // 🔹 توليد SEO Data
      const slug = generateSlug(title);
      const metaDescription = generateMetaDescription(content, title);
      const keywords = extractKeywords(title, content);
      
      let imageUrl = req.file ? `/uploads/news/${req.file.filename}` : null;
      const willBeFeatured = parseBoolean(isFeatured);

      if (willBeFeatured) {
        await News.updateMany({ isFeatured: true }, { $set: { isFeatured: false } });
      }

      const news = await News.create({
        title,
        content,
        category: category || "Sports",
        imageUrl,
        author: req.user?.id,
        isFeatured: willBeFeatured,
        slug,
        metaDescription,
        keywords,
        indexingStatus: "pending"
      });

      // 🎨 توليد OG Image إذا لم يتم رفع صورة
      if (!imageUrl) {
        const ogImagePath = await generateOGImage(title, news._id, category);
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
        const fullUrl = generateNewsUrl(news._id, slug);
        
        retryWithBackoff(async () => {
          const success = await requestIndexing(fullUrl);
          if (success) {
            await News.findByIdAndUpdate(news._id, {
              indexingStatus: "indexed",
              lastIndexedAt: new Date()
            });
            await logIndexing(news._id, fullUrl, "success", null, { action: "create" });
            console.log(`✅ Indexed: ${fullUrl}`);
          }
          return success;
        }, parseInt(process.env.MAX_INDEXING_RETRIES) || 3, 
           parseInt(process.env.INDEXING_RETRY_DELAY) || 1000,
           "News indexing").catch(async (err) => {
          await News.findByIdAndUpdate(news._id, {
            indexingStatus: "failed",
            $inc: { indexingAttempts: 1 }
          });
          await logIndexing(news._id, fullUrl, "failed", err.message, { action: "create" });
          console.error(`❌ Indexing failed: ${err.message}`);
        });

        // 📍 Ping Sitemap
        setTimeout(() => notifySitemap(), 2000);
      }

      res.status(201).json({ 
        success: true,
        message: "News created successfully", 
        news: {
          ...news.toObject(),
          url: generateNewsUrl(news._id, slug)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// 📌 كل الأخبار - Enhanced with pagination
router.get("/", async (req, res, next) => {
  try {
    const { q, category, featured, page = 1, limit = 20, sort = "-createdAt" } = req.query;
    const filter = {};
    
    if (q) filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { content: { $regex: q, $options: "i" } }
    ];
    if (category) filter.category = category;
    if (featured === "true") filter.isFeatured = true;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [news, total] = await Promise.all([
      News.find(filter)
        .populate("author", "username email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      News.countDocuments(filter)
    ]);

    const userId = req.user?.id || null;

    const newsWithMeta = await Promise.all(
      news.map(async (item) => {
        const likedByUser = userId ? item.likes.includes(userId) : false;
        const commentsCount = await NewsComment.countDocuments({ news: item._id });

        return {
          ...item,
          likesCount: item.likes.length,
          likedByUser,
          commentsCount,
          url: generateNewsUrl(item._id, item.slug)
        };
      })
    );

    res.json({
      success: true,
      data: newsWithMeta,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// 🌐 Super SEO Preview Page - Enhanced
router.get("/:id/preview", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id).populate("author", "username");
    if (!item) return res.status(404).send("<h1>News not found</h1>");

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const newsUrl = generateNewsUrl(item._id, item.slug);
    const imageUrl = item.ogImage 
      ? `${baseUrl}${item.ogImage}` 
      : item.imageUrl 
      ? `${baseUrl}${item.imageUrl}` 
      : `${baseUrl}/default-news-image.jpg`;
    
    const description = item.metaDescription || generateMetaDescription(item.content, item.title);
    const keywords = item.keywords || extractKeywords(item.title, item.content);

    // 📋 JSON-LD FULL NEWS SCHEMA - Enhanced
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
        "url": baseUrl,
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
      "keywords": keywords,
      "wordCount": item.content.replace(/<[^>]*>/g, "").split(/s+/).length,
      "inLanguage": "ar",
      "isAccessibleForFree": true
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
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="googlebot" content="index, follow">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${item.title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${item.title}">
    <meta property="og:url" content="${newsUrl}">
    <meta property="og:site_name" content="Mal3abak">
    <meta property="og:locale" content="ar_AR">
    <meta property="article:published_time" content="${item.createdAt}">
    <meta property="article:modified_time" content="${item.updatedAt}">
    <meta property="article:author" content="${item.author?.username || 'Mal3abak'}">
    <meta property="article:section" content="${item.category || 'Sports'}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${item.title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="${item.title}">
    <meta name="twitter:site" content="@mal3abak">
    <meta name="twitter:creator" content="@mal3abak">
    
    <!-- Additional SEO -->
    <meta name="theme-color" content="#667eea">
    <meta name="mobile-web-app-capable" content="yes">
    <link rel="alternate" type="application/rss+xml" title="Mal3abak RSS Feed" href="${baseUrl}/rss.xml">
    
    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
${JSON.stringify(jsonLD, null, 2)}
    </script>
    
    <!-- Preconnect -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="dns-prefetch" href="https://fonts.googleapis.com">
    
    <meta http-equiv="refresh" content="3;url=mal3abak://news/${item._id}">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
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
        .container {
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 {
            font-size: 2em;
            margin-bottom: 20px;
            line-height: 1.4;
        }
        .loader {
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 30px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        .meta {
            margin-top: 20px;
            font-size: 0.9em;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${item.title}</h1>
        <div class="loader"></div>
        <p>جارٍ التحويل إلى التطبيق...</p>
        <div class="meta">
            ${item.category} • ${new Date(item.createdAt).toLocaleDateString('ar-EG')}
        </div>
    </div>
</body>
</html>
`;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// 📌 خبر واحد (API) - Enhanced
router.get("/:id/:slug?", async (req, res, next) => {
  try {
    const item = await News.findById(req.params.id)
      .populate("author", "username email")
      .lean();
      
    if (!item) {
      res.status(404);
      throw new Error("News not found");
    }

    // Increment views asynchronously
    News.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } }).exec();

    const userId = req.user?.id || null;
    const likedByUser = userId ? item.likes.includes(userId) : false;
    const commentsCount = await NewsComment.countDocuments({ news: item._id });

    res.json({
      success: true,
      data: {
        ...item,
        likesCount: item.likes.length,
        likedByUser,
        commentsCount,
        url: generateNewsUrl(item._id, item.slug)
      }
    });
  } catch (err) {
    next(err);
  }
});

// ✏️ تحديث خبر - Enhanced
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
        if (title.length < 3 || title.length > 200) {
          res.status(400);
          throw new Error("title must be between 3 and 200 characters");
        }
        updateData.title = title;
        updateData.slug = generateSlug(title);
      }
      
      if (content) {
        if (content.length < 10) {
          res.status(400);
          throw new Error("content must be at least 10 characters");
        }
        updateData.content = content;
        updateData.metaDescription = generateMetaDescription(content, title);
      }
      
      if (title || content) {
        const currentNews = await News.findById(req.params.id);
        if (currentNews) {
          updateData.keywords = extractKeywords(
            title || currentNews.title,
            content || currentNews.content
          );
        }
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
            if (news) {
              const fullUrl = generateNewsUrl(req.params.id, news.slug);
              retryWithBackoff(() => requestIndexing(fullUrl), 3, 1000, "Featured indexing")
                .then(() => console.log(`✅ Featured news indexed: ${fullUrl}`))
                .catch(err => console.error(`❌ Featured indexing failed: ${err.message}`));
            }
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
      }).populate("author", "username");

      if (!updated) {
        res.status(404);
        throw new Error("News not found");
      }

      // ⭐ أرشفة بعد التعديل
      if (process.env.ENABLE_GOOGLE_INDEXING === "true") {
        const fullUrl = generateNewsUrl(updated._id, updated.slug);
        retryWithBackoff(async () => {
          const success = await requestIndexing(fullUrl);
          if (success) {
            await News.findByIdAndUpdate(updated._id, {
              indexingStatus: "indexed",
              lastIndexedAt: new Date()
            });
            await logIndexing(updated._id, fullUrl, "success", null, { action: "update" });
            console.log(`✅ Updated news indexed: ${fullUrl}`);
          }
          return success;
        }, 3, 1000, "News update indexing").catch(async (err) => {
          await logIndexing(updated._id, fullUrl, "failed", err.message, { action: "update" });
        });
        
        setTimeout(() => notifySitemap(), 2000);
      }

      res.json({ 
        success: true,
        message: "News updated successfully", 
        news: {
          ...updated.toObject(),
          url: generateNewsUrl(updated._id, updated.slug)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// 🗑️ حذف خبر - Enhanced
router.delete("/:id", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    const deleted = await News.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404);
      throw new Error("News not found");
    }
    
    // حذف الملفات المرتبطة
    if (deleted.imageUrl) {
      const imagePath = path.join(__dirname, "..", deleted.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    if (deleted.ogImage) {
      const ogPath = path.join(__dirname, "..", deleted.ogImage);
      if (fs.existsSync(ogPath)) {
        fs.unlinkSync(ogPath);
      }
    }
    
    // 📍 إعادة ping للـ sitemap بعد الحذف
    setTimeout(() => notifySitemap(), 2000);
    
    res.json({ 
      success: true,
      message: "News deleted successfully" 
    });
  } catch (err) {
    next(err);
  }
});

// 💖 Toggle like on news - Enhanced
router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ 
        success: false,
        message: "News article not found" 
      });
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
    
    res.json({ 
      success: true,
      likesCount: news.likes.length, 
      likedByUser 
    });
  } catch (err) {
    next(err);
  }
});

// 📊 احصائيات الأخبار
router.get("/stats/overview", requireAuth, authorize("admin"), async (req, res, next) => {
  try {
    const [total, featured, pending, indexed, failed] = await Promise.all([
      News.countDocuments(),
      News.countDocuments({ isFeatured: true }),
      News.countDocuments({ indexingStatus: "pending" }),
      News.countDocuments({ indexingStatus: "indexed" }),
      News.countDocuments({ indexingStatus: "failed" })
    ]);

    res.json({
      success: true,
      stats: {
        total,
        featured,
        indexing: {
          pending,
          indexed,
          failed
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
