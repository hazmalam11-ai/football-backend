/**
 * 🚀 Ultimate server.js – Optimized for speed, security, and scalability
 * Features:
 * - Helmet + Rate Limiter + CORS
 * - MongoDB stable connection
 * - Unified JSON handling
 * - Socket.io live updates
 * - Auto Fantasy + Sync jobs
 * - Strict routing organization
 */

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const errorHandler = require("./middlewares/errorHandler");

// ===============================
// 🔧 Load environment variables
// ===============================
dotenv.config();
const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.FOOTBALL_API_KEY;

if (!API_KEY) {
  console.warn("⚠️ FOOTBALL_API_KEY missing in .env");
} else {
  console.log("✅ Football API key loaded");
}

// ===============================
// ⚙️ Express / HTTP / Socket setup
// ===============================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(",") || "*", credentials: true }
});

// ===============================
// 🧱 Core middlewares (ordered for performance)
// ===============================

// Security headers first
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// Logging
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// JSON parsing
app.use(express.json({ limit: "10mb" }));

// CORS config
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "https://mal3abak.com"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 600,
    message: { success: false, message: "Too many requests, try again later." },
  })
);

// UTF-8 enforcement
app.use((req, res, next) => {
  if (!req.path.startsWith("/uploads/"))
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// Static uploads
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static("uploads", { maxAge: "30d", etag: true })
);

// ===============================
// 💾 MongoDB connection
// ===============================
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ Mongo connection error:", err);
    process.exit(1);
  });

// Make io accessible
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ===============================
// 🧩 Routes imports
// ===============================
const authRoutes = require("./routes/auth");
const teamRoutes = require("./routes/teams");
const playerRoutes = require("./routes/players");
const coachRoutes = require("./routes/coaches");
const tournamentRoutes = require("./routes/tournaments");
const matchRoutes = require("./routes/matches");
const footballRoutes = require("./routes/football");
const leaguesRoutes = require("./routes/leagues");
const newsRoutes = require("./routes/news");
const commentRoutes = require("./routes/comments");
const newsCommentRoutes = require("./routes/newsComments");
const likesRoutes = require("./routes/likes");
const dashboardRoutes = require("./routes/dashboard");
const usersRoutes = require("./routes/users");

// Fantasy
const fantasyTeamRoutes = require("./routes/fantasyTeams");
const fantasyGameweekRoutes = require("./routes/fantasyGameweeks");
const fantasyLeaderboardRoutes = require("./routes/fantasyLeaderboard");
const fantasyScoringRoutes = require("./routes/fantasyScoring");
const fantasyPointsRoutes = require("./routes/fantasyPoints");
const fantasyMiniLeaguesRoutes = require("./routes/fantasyMiniLeagues");

// Others
const matchDataRoutes = require("./routes/matchData");
const insightsRoutes = require("./routes/insights");

// ===============================
// 🧭 Routes mounting
// ===============================
app.use("/auth", authRoutes);
app.use("/teams", teamRoutes);
app.use("/api/players", playerRoutes);
app.use("/coaches", coachRoutes);
app.use("/tournaments", tournamentRoutes);
app.use("/news", newsRoutes);
app.use("/comments", commentRoutes);
app.use("/news-comments", newsCommentRoutes);
app.use("/likes", likesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/users", usersRoutes);

// ⚽ Football & Matches
app.use("/api/football", footballRoutes); // unified path
app.use("/matches", matchRoutes);

// Leagues / Data
app.use("/api/leagues", leaguesRoutes);
app.use("/api/match-data", matchDataRoutes);
app.use("/api/insights", insightsRoutes);

// Fantasy
app.use("/fantasy/teams", fantasyTeamRoutes);
app.use("/fantasy/gameweeks", fantasyGameweekRoutes);
app.use("/fantasy/leaderboard", fantasyLeaderboardRoutes);
app.use("/fantasy/scoring", fantasyScoringRoutes);
app.use("/fantasy/points", fantasyPointsRoutes);
app.use("/fantasy/mini-leagues", fantasyMiniLeaguesRoutes);

// ===============================
// 💬 Socket.io Events
// ===============================
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join-match", (id) => socket.join(`match-${id}`));
  socket.on("leave-match", (id) => socket.leave(`match-${id}`));

  socket.on("disconnect", () => console.log(`❌ Socket ${socket.id} disconnected`));
});

// ===============================
// 📡 Live update emitters (helpers)
// ===============================
global.sendLiveScoreUpdate = (id, data) =>
  io.to(`match-${id}`).emit("score-update", { matchId: id, ...data, ts: new Date() });

global.sendMatchEvent = (id, data) =>
  io.to(`match-${id}`).emit("match-event", { matchId: id, ...data, ts: new Date() });

global.sendMatchStatusUpdate = (id, status) =>
  io.to(`match-${id}`).emit("match-status", { matchId: id, status, ts: new Date() });

// ===============================
// 🧪 Testing + Health check
// ===============================
app.get("/", (_, res) =>
  res.json({ message: "⚽ Mal3abak backend running", uptime: process.uptime() })
);
app.get("/health", (_, res) => res.json({ status: "ok", db: mongoose.connection.readyState }));

// ===============================
// 🧰 Error handler
// ===============================
app.use(errorHandler);

// ===============================
// 🔁 Auto background jobs
// ===============================
const { updateGameweekPoints } = require("./services/fantasyScoring");
const Gameweek = require("./models/Gameweek");
setInterval(async () => {
  try {
    const gw = await Gameweek.findOne({ isActive: true });
    if (gw) await updateGameweekPoints(gw._id);
  } catch (err) {
    console.error("❌ Fantasy update failed:", err.message);
  }
}, 5 * 60 * 1000);

// Auto sync services
require("./services/autoSync");
require("./services/autoGameweekService").start();

// ===============================
// 🚀 Start server
// ===============================
server.listen(PORT, () =>
  console.log(`🚀 Backend ready on http://localhost:${PORT} [Mode=${process.env.NODE_ENV || "dev"}]`)
);
