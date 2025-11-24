const express = require("express");
const router = express.Router();

const News = require("../models/news");
const Match = require("../models/match");
const Team = require("../models/Team");
const Player = require("../models/Player");

const BASE_URL = "https://mal3abak.com";

function wrapXML(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

// -------------------------
// 1) Sitemap Index
// -------------------------
router.get("/sitemap.xml", (req, res) => {
  const xml = wrapXML(`
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
  </sitemapindex>`);

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// -------------------------
// 2) NEWS Sitemap
// -------------------------
router.get("/sitemaps/news.xml", async (req, res) => {
  const news = await News.find().sort({ createdAt: -1 });

  const urls = news
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

  const xml = wrapXML(`
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`);

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// -------------------------
// 3) MATCHES Sitemap
// -------------------------
router.get("/sitemaps/matches.xml", async (req, res) => {
  const matches = await Match.find().sort({ updatedAt: -1 });

  const urls = matches
    .map(
      (m) => `
    <url>
      <loc>${BASE_URL}/matches/${m._id}</loc>
      <lastmod>${new Date(m.updatedAt || m.createdAt).toISOString()}</lastmod>
      <changefreq>hourly</changefreq>
      <priority>0.8</priority>
    </url>`
    )
    .join("");

  res.header("Content-Type", "application/xml");
  res.send(
    wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`)
  );
});

// -------------------------
// 4) TEAMS Sitemap
// -------------------------
router.get("/sitemaps/teams.xml", async (req, res) => {
  const teams = await Team.find();

  const urls = teams
    .map(
      (t) => `
    <url>
      <loc>${BASE_URL}/teams/${t._id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.7</priority>
    </url>`
    )
    .join("");

  res.header("Content-Type", "application/xml");
  res.send(
    wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`)
  );
});

// -------------------------
// 5) PLAYERS Sitemap
// -------------------------
router.get("/sitemaps/players.xml", async (req, res) => {
  const players = await Player.find();

  const urls = players
    .map(
      (p) => `
    <url>
      <loc>${BASE_URL}/players/${p._id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.6</priority>
    </url>`
    )
    .join("");

  res.header("Content-Type", "application/xml");
  res.send(
    wrapXML(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`)
  );
});

module.exports = router;
