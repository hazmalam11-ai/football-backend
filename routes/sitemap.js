const express = require("express");
const router = express.Router();

const News = require("../models/news");
const Match = require("../models/match");
const Team = require("../models/Team");
const Player = require("../models/Player");

const BASE_URL = "https://mal3abak.com";

/**
 * ===========================
 *  📌 MAIN SITEMAP INDEX
 * ===========================
 */
router.get("/sitemap.xml", (req, res) => {
  const xml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
      <loc>${BASE_URL}/sitemaps/news.xml</loc>
    </sitemap>
    <sitemap>
      <loc>${BASE_URL}/sitemaps/matches.xml</loc>
    </sitemap>
    <sitemap>
      <loc>${BASE_URL}/sitemaps/teams.xml</loc>
    </sitemap>
    <sitemap>
      <loc>${BASE_URL}/sitemaps/players.xml</loc>
    </sitemap>
  </sitemapindex>
  `;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

/**
 * ===========================
 *  📌 NEWS SITEMAP
 * ===========================
 */
router.get("/sitemaps/news.xml", async (req, res) => {
  const items = await News.find().sort({ createdAt: -1 });

  const xmlItems = items
    .map(
      (n) => `
    <url>
      <loc>${BASE_URL}/news/${n._id}</loc>
      <lastmod>${new Date(n.updatedAt || n.createdAt).toISOString()}</lastmod>
      <changefreq>hourly</changefreq>
      <priority>0.9</priority>
    </url>`
    )
    .join("");

  const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlItems}
    </urlset>
  `;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

/**
 * ===========================
 *  📌 MATCHES SITEMAP
 * ===========================
 */
router.get("/sitemaps/matches.xml", async (req, res) => {
  const matches = await Match.find().sort({ updatedAt: -1 });

  const xmlItems = matches
    .map(
      (m) => `
    <url>
      <loc>${BASE_URL}/matches/${m._id}</loc>
      <lastmod>${new Date(m.updatedAt || m.createdAt).toISOString()}</lastmod>
      <changefreq>hourly</changefreq>
      <priority>0.7</priority>
    </url>`
    )
    .join("");

  const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlItems}
    </urlset>
  `;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

/**
 * ===========================
 *  📌 TEAMS SITEMAP
 * ===========================
 */
router.get("/sitemaps/teams.xml", async (req, res) => {
  const teams = await Team.find();

  const xmlItems = teams
    .map(
      (t) => `
    <url>
      <loc>${BASE_URL}/teams/${t._id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.6</priority>
    </url>`
    )
    .join("");

  const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlItems}
    </urlset>
  `;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

/**
 * ===========================
 *  📌 PLAYERS SITEMAP
 * ===========================
 */
router.get("/sitemaps/players.xml", async (req, res) => {
  const players = await Player.find();

  const xmlItems = players
    .map(
      (p) => `
    <url>
      <loc>${BASE_URL}/players/${p._id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.5</priority>
    </url>`
    )
    .join("");

  const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlItems}
    </urlset>
  `;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

module.exports = router;
