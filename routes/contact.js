const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  // TODO: هنا بعدين تخزن في DB أو تبعت إيميل
  return res.status(200).json({ ok: true });
});

module.exports = router;
