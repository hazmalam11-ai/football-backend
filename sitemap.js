const express = require('express');
const router = express.Router();

// مثال: بدلها بالدالة اللي تجيب الأخبار من قاعدة البيانات
async function getAllArticles() {
  return [
    { slug: "test-news-1", updatedAt: new Date() },
    { slug: "test-news-2", updatedAt: new Date() }
  ];
}

router.get('/sitemap.xml', async (req, res) => {
  const baseUrl = 'https://YOUR-DOMAIN.com'; // ← غيّرها لدومين موقعك
  const articles = await getAllArticles();

  const urls = articles.map(a => `
    <url>
      <loc>${baseUrl}/news/${a.slug}</loc>
      <lastmod>${new Date(a.updatedAt).toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

module.exports = router;
