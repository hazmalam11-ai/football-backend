const express = require("express");
const axios = require("axios");
const router = express.Router();

// MODELS
const News = require("../models/news.js");
const Match = require("../models/match.js");
const Team = require("../models/Team.js");
const Player = require("../models/Player.js");

const baseUrl = "https://mal3abak.com";

// ===============================
// 🧩 Sitemap Index (root)
// ===============================
router.get("/sitemap.xml", async (req, res) => {
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>${baseUrl}/sitemaps/static.xml</loc></sitemap>
        <sitemap><loc>${baseUrl}/sitemaps/news.xml</loc></sitemap>
        <sitemap><loc>${baseUrl}/sitemaps/matches.xml</loc></sitemap>
        <sitemap><loc>${baseUrl}/sitemaps/teams.xml</loc></sitemap>
        <sitemap><loc>${baseUrl}/sitemaps/players.xml</loc></sitemap>
      </sitemapindex>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Sitemap index error:", err);
    res.status(500).send("Error generating sitemap index");
  }
});

// ===============================
// 🧭 STATIC Sitemap
// ===============================
router.get("/sitemaps/static.xml", (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
      <url><loc>${baseUrl}/news</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>
      <url><loc>${baseUrl}/matches</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>
      <url><loc>${baseUrl}/teams</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
      <url><loc>${baseUrl}/players</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
    </urlset>`;
  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ===============================
// 📰 NEWS Sitemap (with images)
// ===============================
router.get("/sitemaps/news.xml", async (req, res) => {
  try {
    const newsItems = await News.find().sort({ createdAt: -1 }).limit(1000);
    const newsUrls = newsItems
      .map((n) => {
        const imgTag = n.image
          ? `<image:image>
              <image:loc>${baseUrl}${n.image}</image:loc>
              <image:caption>${n.title || "News Image"}</image:caption>
            </image:image>`
          : "";
        return `
        <url>
          <loc>${baseUrl}/news/${n._id}</loc>
          <lastmod>${new Date(n.updatedAt || n.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.9</priority>
          ${imgTag}
        </url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
        ${newsUrls}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("News sitemap error:", err);
    res.status(500).send("Error generating news sitemap");
  }
});

// ===============================
// ⚽ MATCHES Sitemap
// ===============================
router.get("/sitemaps/matches.xml", async (req, res) => {
  try {
    const matches = await Match.find().sort({ updatedAt: -1 });
    const matchUrls = matches
      .map((m) => `
        <url>
          <loc>${baseUrl}/matches/${m._id}</loc>
          <lastmod>${new Date(m.updatedAt || m.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.8</priority>
        </url>
      `)
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${matchUrls}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Matches sitemap error:", err);
    res.status(500).send("Error generating matches sitemap");
  }
});

// ===============================
// 🏆 TEAMS Sitemap
// ===============================
router.get("/sitemaps/teams.xml", async (req, res) => {
  try {
    const teams = await Team.find();
    const teamUrls = teams
      .map((t) => `
        <url>
          <loc>${baseUrl}/teams/${t._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `)
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${teamUrls}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Teams sitemap error:", err);
    res.status(500).send("Error generating teams sitemap");
  }
});

// ===============================
// 👟 PLAYERS Sitemap
// ===============================
router.get("/sitemaps/players.xml", async (req, res) => {
  try {
    const players = await Player.find();
    const playerUrls = players
      .map((p) => `
        <url>
          <loc>${baseUrl}/players/${p._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.6</priority>
        </url>
      `)
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${playerUrls}
      </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Players sitemap error:", err);
    res.status(500).send("Error generating players sitemap");
  }
});

// ===============================
// 🔔 AUTO-PING Google & Bing
// ===============================
router.get("/sitemaps/ping", async (req, res) => {
  try {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    await axios.get(`https://www.google.com/ping?sitemap=${sitemapUrl}`);
    await axios.get(`https://www.bing.com/ping?sitemap=${sitemapUrl}`);
    res.json({ success: true, message: "Ping sent to Google & Bing successfully." });
  } catch (err) {
    console.error("Ping error:", err);
    res.status(500).json({ success: false, message: "Ping failed." });
  }
});

module.exports = router;
