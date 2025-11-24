const express = require("express");
const router = express.Router();

const News = require("../models/news");
const Match = require("../models/match");
const Team = require("../models/Team");
const Player = require("../models/Player");

const BASE_URL = "https://mal3abak.com";

// Cache for 10 minutes
let cache = {};
const cacheDuration = 10 * 60 * 1000;

function wrapXML(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body.trim()}`;
}

function sendXML(res, xml) {
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.send(xml);
}

async function generateAndCache(key, fn) {
  const now = Date.now();
  if (cache[key] && now - cache[key].time < cacheDuration) {
    return cache[key].xml;
  }

  const xml = await fn();
  cache[key] = { xml, time: now };
  return xml;
}

// ----------------------------------------
// 1) MAIN SITEMAP INDEX
// ----------------------------------------
router.get("/sitemap.xml", async (req, res) => {
  try {
    const xml = wrapXML(`
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>${BASE_URL}/sitemaps/news.xml</loc></sitemap>
        <sitemap><loc>${BASE_URL}/sitemaps/matches.xml</loc></sitemap>
        <sitemap><loc>${BASE_URL}/sitemaps/teams.xml</loc></sitemap>
        <sitemap><loc>${BASE_URL}/sitemaps/players.xml</loc></sitemap>
      </sitemapindex>
    `);

    sendXML(res, xml);

    // AUTO PING Google & Bing
    fetch(`https://www.google.com/ping?sitemap=${BASE_URL}/sitemaps/sitemap.xml`).catch(() => {});
    fetch(`https://www.bing.com/ping?sitemap=${BASE_URL}/sitemaps/sitemap.xml`).catch(() => {});

  } catch (err) {
    console.error("Sitemap index error:", err);
    res.status(500).send("Error generating sitemap index");
  }
});

// ----------------------------------------
// 2) NEWS SITEMAP
// ----------------------------------------
router.get("/news.xml", async (req, res) => {
  try {
    const xml = await generateAndCache("news", async () => {
      const news = await News.find().sort({ createdAt: -1 });

      const urls = news.map(n => `
        <url>
          <loc>${BASE_URL}/news/${n._id}</loc>
          <lastmod>${new Date(n.updatedAt || n.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.9</priority>
        </url>
      `).join("");

      return wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    });

    sendXML(res, xml);
  } catch (err) {
    console.error("News sitemap error:", err);
    res.status(500).send("Error generating news sitemap");
  }
});

// ----------------------------------------
// 3) MATCHES SITEMAP
// ----------------------------------------
router.get("/matches.xml", async (req, res) => {
  try {
    const xml = await generateAndCache("matches", async () => {
      const matches = await Match.find().sort({ updatedAt: -1 });

      const urls = matches.map(m => `
        <url>
          <loc>${BASE_URL}/matches/${m._id}</loc>
          <lastmod>${new Date(m.updatedAt || m.createdAt).toISOString()}</lastmod>
          <changefreq>hourly</changefreq>
          <priority>0.8</priority>
        </url>
      `).join("");

      return wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    });

    sendXML(res, xml);
  } catch (err) {
    console.error("Matches sitemap error:", err);
    res.status(500).send("Error generating matches sitemap");
  }
});

// ----------------------------------------
// 4) TEAMS SITEMAP
// ----------------------------------------
router.get("/teams.xml", async (req, res) => {
  try {
    const xml = await generateAndCache("teams", async () => {
      const teams = await Team.find();

      const urls = teams.map(t => `
        <url>
          <loc>${BASE_URL}/teams/${t._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `).join("");

      return wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    });

    sendXML(res, xml);
  } catch (err) {
    console.error("Teams sitemap error:", err);
    res.status(500).send("Error generating teams sitemap");
  }
});

// ----------------------------------------
// 5) PLAYERS SITEMAP
// ----------------------------------------
router.get("/players.xml", async (req, res) => {
  try {
    const xml = await generateAndCache("players", async () => {
      const players = await Player.find();

      const urls = players.map(p => `
        <url>
          <loc>${BASE_URL}/players/${p._id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.6</priority>
        </url>
      `).join("");

      return wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    });

    sendXML(res, xml);
  } catch (err) {
    console.error("Players sitemap error:", err);
    res.status(500).send("Error generating players sitemap");
  }
});

module.exports = router;
