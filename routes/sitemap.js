const express = require("express");
const router = express.Router();
const { SitemapStream, streamToPromise } = require("sitemap");
const zlib = require("zlib");

const News = require("../models/news");
const Match = require("../models/match");
const Team = require("../models/Team");
const Player = require("../models/Player");

const BASE_URL = process.env.BASE_URL || "https://mal3abak.com";

let cachedSitemap = null;
let lastGenTime = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 دقايق بس

router.get("/sitemap.xml", async (req, res) => {
  try {
    res.header("Content-Type", "application/xml");
    res.header("Content-Encoding", "gzip");

    if (cachedSitemap && (Date.now() - lastGenTime < CACHE_TTL)) {
      return res.send(cachedSitemap);
    }

    const smStream = new SitemapStream({ hostname: BASE_URL });
    const pipeline = smStream.pipe(zlib.createGzip());

    smStream.write({ url: "/", changefreq: "daily", priority: 1.0 });
    smStream.write({ url: "/news", changefreq: "hourly", priority: 0.9 });
    smStream.write({ url: "/matches", changefreq: "hourly", priority: 0.9 });
    smStream.write({ url: "/teams", changefreq: "weekly", priority: 0.7 });
    smStream.write({ url: "/players", changefreq: "weekly", priority: 0.7 });

    // قلل العدد لـ 500 بس عشان الذاكرة
    const [news, matches, teams, players] = await Promise.all([
      News.find({}, "_id updatedAt createdAt slug").lean().sort({ createdAt: -1 }).limit(500),
      Match.find({}, "_id updatedAt createdAt").lean().sort({ createdAt: -1 }).limit(500),
      Team.find({}, "_id updatedAt createdAt").lean().limit(200),
      Player.find({}, "_id updatedAt createdAt").lean().limit(200),
    ]);

    news.forEach((n) => {
      smStream.write({
        url: `/news/${n.slug || n._id}`,
        lastmod: n.updatedAt || n.createdAt,
        changefreq: "daily",
        priority: 0.8,
      });
    });

    matches.forEach((m) => {
      smStream.write({
        url: `/matches/${m._id}`,
        lastmod: m.updatedAt || m.createdAt,
        changefreq: "hourly",
        priority: 0.7,
      });
    });

    teams.forEach((t) => {
      smStream.write({
        url: `/teams/${t._id}`,
        lastmod: t.updatedAt || t.createdAt,
        changefreq: "weekly",
        priority: 0.6,
      });
    });

    players.forEach((p) => {
      smStream.write({
        url: `/players/${p._id}`,
        lastmod: p.updatedAt || p.createdAt,
        changefreq: "weekly",
        priority: 0.6,
      });
    });

    smStream.end();

    const sitemap = await streamToPromise(pipeline);
    cachedSitemap = sitemap;
    lastGenTime = Date.now();

    // امسح المتغيرات من الذاكرة
    news.length = 0;
    matches.length = 0;
    teams.length = 0;
    players.length = 0;

    res.send(sitemap);
  } catch (err) {
    console.error("❌ Sitemap error:", err);
    res.status(500).end();
  }
});

module.exports = router;
