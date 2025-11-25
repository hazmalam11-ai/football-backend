
```javascript
/**
 * 🚀 ULTRA-SECURE & LIGHTNING-FAST Server - Enterprise Grade
 */

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const path = require("path");
const errorHandler = require("./middlewares/errorHandler");

dotenv.config();

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.FOOTBALL_API_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!API_KEY) console.warn("⚠️ FOOTBALL_API_KEY missing in .env");
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is required!");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(mongoSanitize());
app.use(hpp({ whitelist: ["page", "limit", "sort", "fields", "filter"] }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use("/sitemaps", express.static(path.join(__dirname, "sitemaps"), {
  setHeaders: (res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "https://mal3abak.com"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      console.warn(`🚫 CORS blocked: ${origin}`);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

app.use(createRateLimiter(10 * 60 * 1000, 600, "Global rate limit exceeded"));
const authLimiter = createRateLimiter(15 * 60 * 1000, 10, "Too many login attempts");
const apiLimiter = createRateLimiter(1 * 60 * 1000, 100, "API rate limit exceeded");

app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
app.set("trust proxy", 1);

const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  socketTimeoutMS: 45000,
};

mongoose
  .connect(MONGO_URI, mongoOptions)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

app.use((req, res, next) => {
  req.io = io;
  next();
});

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
const fantasyTeamRoutes = require("./routes/fantasyTeams");
const fantasyLeaderboardRoutes = require("./routes/fantasyLeaderboard");
const fantasyGameweekRoutes = require("./routes/fantasygameweeks");
const fantasyScoringRoutes = require("./routes/fantasyScoring");
const fantasyPointsRoutes = require("./routes/fantasyPoints");
const fantasyMiniLeaguesRoutes = require("./routes/fantasyMiniLeagues");
const matchDataRoutes = require("./routes/matchData");
const insightsRoutes = require("./routes/insights");
const sitemapRoutes = require("./routes/sitemap");

app.use("/auth", authLimiter, authRoutes);
app.use("/teams", apiLimiter, teamRoutes);
app.use("/api/players", apiLimiter, playerRoutes);
app.use("/coaches", apiLimiter, coachRoutes);
app.use("/tournaments", apiLimiter, tournamentRoutes);
app.use("/news", newsRoutes);
app.use("/comments", commentRoutes);
app.use("/news-comments", newsCommentRoutes);
app.use("/likes", likesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/users", usersRoutes);
app.use("/api/football", apiLimiter, footballRoutes);
app.use("/matches", matchRoutes);
app.use("/api/leagues", leaguesRoutes);
app.use("/api/match-data", matchDataRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/fantasy/teams", fantasyTeamRoutes);
app.use("/fantasy/gameweeks", fantasyGameweekRoutes);
app.use("/fantasy/leaderboard", fantasyLeaderboardRoutes);
app.use("/fantasy/scoring", fantasyScoringRoutes);
app.use("/fantasy/points", fantasyPointsRoutes);
app.use("/fantasy/mini-leagues", fantasyMiniLeaguesRoutes);
app.use("/", sitemapRoutes);

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join-match", (id) => {
    if (!id || typeof id !== "string") return;
    socket.join(`match-${id}`);
  });

  socket.on("leave-match", (id) => {
    if (!id || typeof id !== "string") return;
    socket.leave(`match-${id}`);
  });

  socket.on("disconnect", (reason) => console.log(`❌ Socket disconnected: ${reason}`));
});

global.sendLiveScoreUpdate = (id, data) => {
  if (!id || !data) return;
  io.to(`match-${id}`).emit("score-update", { matchId: id, ...data, ts: Date.now() });
};

app.get("/", (req, res) => {
  res.json({
    message: "⚽ Mal3abak Backend - Ultra Secure Edition",
    version: "2.0.0",
    uptime: process.uptime(),
    mode: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    dbConnected: mongoose.connection.readyState === 1,
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

try {
  require("./services/autoSync");
  require("./services/autoGameweekService").start();
  console.log("✅ Background services started");
} catch (err) {
  console.warn("⚠️ Background services not available:", err.message);
}

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 MAL3ABAK BACKEND - ULTRA SECURE EDITION");
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`💻 CPU Cores: ${os.cpus().length}`);
  console.log("🔒 Security: MAXIMUM | ⚡ Performance: OPTIMIZED");
  console.log("=".repeat(60) + "\n");
});

setInterval(() => {
  const used = process.memoryUsage();
  if (used.heapUsed / used.heapTotal > 0.9) {
    console.warn("⚠️ HIGH MEMORY USAGE:", {
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    });
  }
}, 60000);

module.exports = server;
