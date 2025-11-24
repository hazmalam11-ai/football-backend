const express = require("express");
const router = express.Router();
// MODELS
const News = require("../models/news.js");
const Match = require("../models/match.js");
const Team = require("../models/Team.js");     // ← كدا صح
const Player = require("../models/Player.js"); // ← كدا صح
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://mal3abak.com";

    // ============= NEWS =================
    const newsItems = await News.find().sort({ createdAt: -1 });
    const newsUrls = newsItems
      .map((n) => {
        return `
        <url>
          <loc>${baseUrl}/news/${n._id}</loc>
          <lastmod>${new Date(n.updatedAt || n.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.9</priority>
        </url>`;
      })
      .join("");

    // ============= MATCHES =================
    const matches = await Match.find().sort({ updatedAt: -1 });
    const matchUrls = matches
      .map((m) => {
        return `
        <url>
          <loc>${baseUrl}/matches/${m._id}</loc>
          <lastmod>${new Date(m.updatedAt || m.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.7</priority>
        </url>`;
      })
      .join("");

    // ============= TEAMS =================
    const teams = await Team.find();
    const teamUrls = teams
      .map((t) => {
        return `
        <url>
          <loc>${baseUrl}/teams/${t._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.6</priority>
        </url>`;
      })
      .join("");

    // ============= PLAYERS =================
    const players = await Player.find();
    const playerUrls = players
      .map((p) => {
        return `
        <url>
          <loc>${baseUrl}/players/${p._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.5</priority>
        </url>`;
      })
      .join("");

    // ============= STATIC =================
    const staticUrls = `
      <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${baseUrl}/news</loc>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>${baseUrl}/matches</loc>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      <url>
        <loc>${baseUrl}/teams</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
      <url>
        <loc>${baseUrl}/players</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
    `;

    // ============= XML JOIN =================
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${staticUrls}
        ${newsUrls}
        ${matchUrls}
        ${teamUrls}
        ${playerUrls}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Error generating sitemap");
  }
});

module.exports = router;
