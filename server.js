// server.js (Enhanced with Socket.io + Football API + Fantasy + Sync Services)
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const errorHandler = require("./middlewares/errorHandler");

// ✅ تحميل متغيرات البيئة
dotenv.config();

// ✅ تحقق من API Key
if (!process.env.FOOTBALL_API_KEY) {
  console.error("❌ Football API Key is missing! أضف FOOTBALL_API_KEY في ملف .env");
} else {
  console.log("⚽ Using API KEY:", process.env.FOOTBALL_API_KEY);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5050;

// ✅ Socket.io Setup
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://192.168.1.8:3000"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// ✅ Middleware
app.use(express.json({ charset: 'utf-8' }));
app.use(bodyParser.json({ charset: 'utf-8' }));
app.use(morgan("dev"));

// Ensure UTF-8 encoding for all responses (except static files)
app.use((req, res, next) => {
  // Skip setting Content-Type for static files (images, etc.)
  if (!req.path.startsWith('/uploads/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});
// Configure helmet to allow cross-origin images (for admin on :3000 fetching :5050 uploads)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ✅ CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Ensure CORS headers for static assets (uploads)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
    res.setHeader('Vary', 'Origin');
  }
  next();
});

// ✅ Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Static folder for uploads (🖼️ الصور) with permissive CORP for images
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    // Set proper content type for images
    if (req.path.match(/\.(png)$/i)) {
      res.setHeader('Content-Type', 'image/png');
    } else if (req.path.match(/\.(webp)$/i)) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (req.path.match(/\.(jpg|jpeg)$/i)) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (req.path.match(/\.(gif)$/i)) {
      res.setHeader('Content-Type', 'image/gif');
    }
    next();
  },
  express.static("uploads")
);

// ===============================
// ✅ Routes
const authRoutes = require("./routes/auth");
const teamRoutes = require("./routes/teams");
const playerRoutes = require("./routes/players");
const coachRoutes = require("./routes/coaches");
const tournamentRoutes = require("./routes/tournaments");
const matchRoutes = require("./routes/matches");
const newsRoutes = require("./routes/news");
const commentRoutes = require("./routes/comments");
const newsCommentRoutes = require("./routes/newsComments");
const likesRoutes = require("./routes/likes");
const dashboardRoutes = require("./routes/dashboard");
const footballRoutes = require("./routes/football");
const usersRoutes = require("./routes/users");

// ✅ Fantasy Routes
const fantasyTeamRoutes = require("./routes/fantasyTeams");
const fantasyGameweekRoutes = require("./routes/fantasyGameweeks");
const fantasyLeaderboardRoutes = require("./routes/fantasyLeaderboard");
const fantasyScoringRoutes = require("./routes/fantasyScoring");
const fantasyPointsRoutes = require("./routes/fantasyPoints");
const fantasyMiniLeaguesRoutes = require("./routes/fantasyMiniLeagues");
const leaguesRoutes = require("./routes/leagues");
const matchDataRoutes = require("./routes/matchData");
const insightsRoutes = require("./routes/insights");

// ✅ Use Routes
app.use("/auth", authRoutes);
app.use("/teams", teamRoutes);
app.use("/api/players", playerRoutes);
app.use("/coaches", coachRoutes);
app.use("/tournaments", tournamentRoutes);
app.use("/matches", matchRoutes);
app.use("/news", newsRoutes);
app.use("/news-comments", newsCommentRoutes);
app.use("/comments", commentRoutes);
app.use("/likes", likesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/users", usersRoutes);
app.use("/api/football", footballRoutes);
app.use("/api/leagues", leaguesRoutes);

// ✅ Fantasy APIs
app.use("/fantasy/teams", fantasyTeamRoutes);
app.use("/fantasy/gameweeks", fantasyGameweekRoutes);
app.use("/fantasy/leaderboard", fantasyLeaderboardRoutes);
app.use("/fantasy/scoring", fantasyScoringRoutes);
app.use("/fantasy/points", fantasyPointsRoutes);
app.use("/fantasy/mini-leagues", fantasyMiniLeaguesRoutes);

// ✅ Match Data APIs
app.use("/api/match-data", matchDataRoutes);

// ✅ Insights APIs
app.use("/api/insights", insightsRoutes);

// ===============================
// ✅ Socket.io Live Updates
io.on("connection", (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  socket.on("join-match", (matchId) => {
    socket.join(`match-${matchId}`);
    console.log(`👤 User ${socket.id} joined match ${matchId}`);
  });

  socket.on("leave-match", (matchId) => {
    socket.leave(`match-${matchId}`);
    console.log(`👤 User ${socket.id} left match ${matchId}`);
  });

  socket.on("disconnect", () => {
    console.log(`👋 User disconnected: ${socket.id}`);
  });
});

// ===============================
// ✅ Live Match Updates Functions
const sendLiveScoreUpdate = (matchId, scoreData) => {
  io.to(`match-${matchId}`).emit("score-update", {
    matchId,
    homeScore: scoreData.homeScore,
    awayScore: scoreData.awayScore,
    timestamp: new Date(),
  });
};

const sendMatchEvent = (matchId, eventData) => {
  io.to(`match-${matchId}`).emit("match-event", {
    matchId,
    type: eventData.type,
    minute: eventData.minute,
    player: eventData.player,
    team: eventData.team,
    description: eventData.description,
    timestamp: new Date(),
  });
};

const sendMatchStatusUpdate = (matchId, status) => {
  io.to(`match-${matchId}`).emit("match-status", {
    matchId,
    status,
    timestamp: new Date(),
  });
};

global.sendLiveScoreUpdate = sendLiveScoreUpdate;
global.sendMatchEvent = sendMatchEvent;
global.sendMatchStatusUpdate = sendMatchStatusUpdate;

// ===============================
// ✅ Array مؤقتة لتسجيل المستخدمين
let users = [];

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "الرجاء إدخال اسم المستخدم وكلمة المرور" });
  }

  const newUser = { username, password };
  users.push(newUser);

  res.json({ message: "تم التسجيل بنجاح ✅", user: newUser });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res
      .status(401)
      .json({ error: "❌ اسم المستخدم أو كلمة المرور غير صحيحة" });
  }

  res.json({ message: "✅ تم تسجيل الدخول بنجاح", user });
});

// ===============================
// ✅ Test API لتجربة Live Updates
app.post("/api/test-live-update", (req, res) => {
  const { matchId, type, data } = req.body;

  if (type === "score") {
    sendLiveScoreUpdate(matchId, data);
  } else if (type === "event") {
    sendMatchEvent(matchId, data);
  } else if (type === "status") {
    sendMatchStatusUpdate(matchId, data.status);
  }

  res.json({ message: "Live update sent successfully!" });
});

// ✅ Test routes
app.get("/", (req, res) => {
  res.send("🚀 Football API with Fantasy + Live Updates running!");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from backend with Socket.io + Fantasy!" });
});

// ✅ Error Handler
app.use(errorHandler);

// ===============================
// ✅ تشغيل Sync Services
const { updateGameweekPoints } = require("./services/fantasyScoring");

// 🟢 تحديث النقاط (Fantasy) كل 5 دقايق
setInterval(async () => {
  try {
    const activeGameweek = await require("./models/Gameweek").findOne({ isActive: true });
    if (activeGameweek) {
      await updateGameweekPoints(activeGameweek._id);
    }
  } catch (err) {
    console.error("❌ Error updating fantasy points:", err.message);
  }
}, 1000 * 60 * 5);

// 🟢 Auto Sync System (Matches + Live)
require("./services/autoSync.js"); // ✅ هنا الاصلاح

// 🟢 Auto Gameweek Management System
const autoGameweekService = require("./services/autoGameweekService");
autoGameweekService.start(); // ✅ Start auto gameweek management

// ✅ Start server
server.listen(PORT, () =>
  console.log(`🚀 Server with Fantasy running at http://localhost:${PORT}`)
);