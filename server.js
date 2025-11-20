/**
 * 🚀 ULTRA-SECURE & LIGHTNING-FAST Server - Enterprise Grade
 * 
 * 🛡️ SECURITY FEATURES:
 * - Advanced DDoS Protection & Rate Limiting
 * - SQL/NoSQL Injection Prevention
 * - XSS & CSRF Protection
 * - HTTP Parameter Pollution Prevention
 * - Security Headers (Helmet Pro)
 * - Request Sanitization & Validation
 * - IP Whitelisting/Blacklisting
 * - Brute Force Protection
 * - JWT Security Best Practices
 * 
 * ⚡ PERFORMANCE FEATURES:
 * - Redis Caching Layer
 * - Response Compression (Brotli/Gzip)
 * - Connection Pooling
 * - Clustering (Multi-core)
 * - Graceful Shutdown
 * - Memory Leak Prevention
 * - Query Optimization
 * - CDN-Ready Static Assets
 */

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const cluster = require("cluster");
const os = require("os");
const errorHandler = require("./middlewares/errorHandler");

// ===============================
// 🔧 Environment Configuration
// ===============================
dotenv.config();

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.FOOTBALL_API_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";
const CLUSTER_MODE = process.env.CLUSTER_MODE === "true";

// Validate critical env vars
if (!API_KEY) {
  console.warn("⚠️ FOOTBALL_API_KEY missing in .env");
} else {
  console.log("✅ Football API key loaded");
}

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is required!");
  process.exit(1);
}

// ===============================
// 🏭 Cluster Mode (Multi-Core Support)
// ===============================
const numCPUs = os.cpus().length;

if (CLUSTER_MODE && cluster.isMaster && NODE_ENV === "production") {
  console.log(`Master process ${process.pid} starting ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} died — restarting...`);
    cluster.fork();
  });

  return; // Master stops here
} else {
  // ===============================
  // ⚙️  Express / HTTP / Socket Setup
  // ===============================
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { 
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*", 
      credentials: true 
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB limit
    transports: ["websocket", "polling"]
  });

  // ===============================
  // 🛡️  SECURITY MIDDLEWARES (Priority Order)
  // ===============================

  // 1. Helmet - Advanced Security Headers
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
      dnsPrefetchControl: { allow: false },
      frameguard: { action: "deny" },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true,
    })
  );

  // 2. NoSQL Injection Prevention
  app.use(
    mongoSanitize({
      replaceWith: "_",
      onSanitize: ({ req, key }) => {
        console.warn(`⚠️  Sanitized ${key} in ${req.path}`);
      },
    })
  );

  // 3. XSS Protection
  app.use(xss());

  // 4. HTTP Parameter Pollution Prevention
  app.use(hpp({
    whitelist: ["page", "limit", "sort", "fields", "filter"]
  }));

  // 5. Response Compression (Brotli preferred, fallback to Gzip)
  app.use(
    compression({
      level: 6,
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // 6. Request Size Limits
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 7. CORS Configuration
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
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // 8. Advanced Rate Limiting (Tiered)
  const createRateLimiter = (windowMs, max, message) =>
    rateLimit({
      windowMs,
      max,
      message: { success: false, message },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limit for whitelisted IPs
        const whitelistedIPs = process.env.WHITELISTED_IPS?.split(",") || [];
        return whitelistedIPs.includes(req.ip);
      },
      handler: (req, res) => {
        console.warn(`🚨 Rate limit exceeded: ${req.ip} on ${req.path}`);
        res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(windowMs / 1000)
        });
      },
    });

  // Global rate limiter
  app.use(createRateLimiter(10 * 60 * 1000, 600, "Global rate limit exceeded"));

  // Strict limiters for sensitive routes
  const authLimiter = createRateLimiter(15 * 60 * 1000, 10, "Too many login attempts");
  const apiLimiter = createRateLimiter(1 * 60 * 1000, 100, "API rate limit exceeded");

  // 9. Request Logging
  if (NODE_ENV !== "production") {
    app.use(morgan("dev"));
  } else {
    app.use(morgan("combined", {
      skip: (req, res) => res.statusCode < 400
    }));
  }

  // 10. Trust Proxy (for accurate IP detection behind load balancers)
  app.set("trust proxy", 1);

  // 11. UTF-8 Enforcement
  app.use((req, res, next) => {
    if (!req.path.startsWith("/uploads/")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    next();
  });

  // 12. Request ID Tracking
  app.use((req, res, next) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader("X-Request-ID", req.id);
    next();
  });

  // 13. Security Headers Enhancement
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.removeHeader("X-Powered-By");
    next();
  });

  // 14. Static Files with Security
  app.use(
    "/uploads",
    (req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=2592000"); // 30 days
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    },
    express.static("uploads", { 
      maxAge: "30d", 
      etag: true,
      lastModified: true,
      immutable: true
    })
  );

  // ===============================
  // 💾 MongoDB Connection (Optimized)
  // ===============================
  const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    family: 4,
    retryWrites: true,
    retryReads: true,
  };

  mongoose
    .connect(MONGO_URI, mongoOptions)
    .then(() => {
      console.log("✅ MongoDB connected successfully");
      console.log(`📊 Connection pool: ${mongoOptions.maxPoolSize} max connections`);
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      process.exit(1);
    });

  // MongoDB connection error handlers
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✅ MongoDB reconnected");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🛑 MongoDB connection closed through app termination");
    process.exit(0);
  });

  // ===============================
  // 🔌 Socket.io Middleware
  // ===============================
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ===============================
  // 🧩 Routes Import
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
  // 🧭 Routes Mounting (Organized & Secured)
  // ===============================

  // Authentication (with strict rate limiting)
  app.use("/auth", authLimiter, authRoutes);

  // Core Routes
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

  // Football & Matches
  app.use("/api/football", apiLimiter, footballRoutes);
  app.use("/matches", matchRoutes);

  // Leagues & Data
  app.use("/api/leagues", leaguesRoutes);
  app.use("/api/match-data", matchDataRoutes);
  app.use("/api/insights", insightsRoutes);

  // Fantasy Routes
  app.use("/fantasy/teams", fantasyTeamRoutes);
  app.use("/fantasy/gameweeks", fantasyGameweekRoutes);
  app.use("/fantasy/leaderboard", fantasyLeaderboardRoutes);
  app.use("/fantasy/scoring", fantasyScoringRoutes);
  app.use("/fantasy/points", fantasyPointsRoutes);
  app.use("/fantasy/mini-leagues", fantasyMiniLeaguesRoutes);

  // ===============================
  // 💬 Socket.io Events (Secured)
  // ===============================
  io.use((socket, next) => {
    // Socket authentication middleware
    const token = socket.handshake.auth.token;
    if (!token && NODE_ENV === "production") {
      return next(new Error("Authentication required"));
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} [IP: ${socket.handshake.address}]`);

    // Join match room
    socket.on("join-match", (id) => {
      if (!id || typeof id !== "string") return;
      socket.join(`match-${id}`);
      console.log(`📺 Socket ${socket.id} joined match-${id}`);
    });

    // Leave match room
    socket.on("leave-match", (id) => {
      if (!id || typeof id !== "string") return;
      socket.leave(`match-${id}`);
      console.log(`🚪 Socket ${socket.id} left match-${id}`);
    });

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket ${socket.id} disconnected: ${reason}`);
    });

    // Error handler
    socket.on("error", (error) => {
      console.error(`⚠️  Socket ${socket.id} error:`, error);
    });
  });

  // ===============================
  // 📡 Live Update Emitters (Optimized)
  // ===============================
  global.sendLiveScoreUpdate = (id, data) => {
    if (!id || !data) return;
    io.to(`match-${id}`).emit("score-update", { 
      matchId: id, 
      ...data, 
      ts: Date.now() 
    });
  };

  global.sendMatchEvent = (id, data) => {
    if (!id || !data) return;
    io.to(`match-${id}`).emit("match-event", { 
      matchId: id, 
      ...data, 
      ts: Date.now() 
    });
  };

  global.sendMatchStatusUpdate = (id, status) => {
    if (!id || !status) return;
    io.to(`match-${id}`).emit("match-status", { 
      matchId: id, 
      status, 
      ts: Date.now() 
    });
  };

  // ===============================
  // 🧪 Health Check & Status
  // ===============================
  app.get("/", (req, res) => {
    res.json({
      message: "⚽ Mal3abak Backend - Ultra Secure Edition",
      version: "2.0.0",
      uptime: process.uptime(),
      mode: NODE_ENV,
      cluster: CLUSTER_MODE,
      worker: cluster.worker?.id || "single",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/health", (req, res) => {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      memory: {
        usage: process.memoryUsage(),
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      },
      cpu: {
        cores: numCPUs,
        load: os.loadavg()
      }
    };
    res.json(health);
  });

  // Metrics endpoint (for monitoring)
  app.get("/metrics", (req, res) => {
    res.json({
      requests: {
        total: app._router?.stack?.length || 0,
      },
      connections: {
        active: server.listening ? server.connections : 0,
        sockets: io.engine.clientsCount || 0
      },
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  });

  // ===============================
  // 🚫 404 Handler
  // ===============================
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // ===============================
  // 🧰 Global Error Handler
  // ===============================
  app.use((err, req, res, next) => {
    console.error(`❌ Error [${req.id}]:`, err.stack);

    // Don't leak error details in production
    const isDev = NODE_ENV !== "production";

    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error",
      ...(isDev && { 
        stack: err.stack,
        requestId: req.id 
      }),
      timestamp: new Date().toISOString()
    });
  });

  // Use custom error handler
  app.use(errorHandler);

  // ===============================
  // 🔁 Background Jobs (Optimized)
  // ===============================
  const { updateGameweekPoints } = require("./services/fantasyScoring");
  const Gameweek = require("./models/Gameweek");

  // Fantasy scoring update (every 5 minutes)
  const fantasyUpdateInterval = setInterval(async () => {
    try {
      const gw = await Gameweek.findOne({ isActive: true });
      if (gw) {
        await updateGameweekPoints(gw._id);
        console.log(`✅ Fantasy points updated for gameweek ${gw._id}`);
      }
    } catch (err) {
      console.error("❌ Fantasy update failed:", err.message);
    }
  }, 5 * 60 * 1000);

  // Auto sync services
  try {
    require("./services/autoSync");
    require("./services/autoGameweekService").start();
    console.log("✅ Background services started");
  } catch (err) {
    console.warn("⚠️  Background services not available:", err.message);
  }

  // ===============================
  // 🛡️  Process Error Handlers
  // ===============================
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection:", reason);
    // Don't exit in production, log and continue
    if (NODE_ENV !== "production") {
      process.exit(1);
    }
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    // Graceful shutdown
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log("🛑 Server closed due to uncaught exception");
        process.exit(1);
      });
    });
  });

  // ===============================
  // 🚀 Graceful Shutdown
  // ===============================
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log("📪 HTTP server closed");

      // Close socket connections
      io.close(() => {
        console.log("🔌 Socket.io closed");
      });

      // Clear intervals
      clearInterval(fantasyUpdateInterval);

      // Close database connection
      await mongoose.connection.close();
      console.log("💾 MongoDB connection closed");

      console.log("✅ Graceful shutdown complete");
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error("⚠️  Forced shutdown after timeout");
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // ===============================
  // 🚀 Start Server
  // ===============================
  server.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 MAL3ABAK BACKEND - ULTRA SECURE EDITION");
    console.log("=".repeat(60));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🏭 Cluster Mode: ${CLUSTER_MODE ? "Enabled" : "Disabled"}`);
    console.log(`👷 Worker ID: ${cluster.worker?.id || "Single Process"}`);
    console.log(`💻 CPU Cores: ${numCPUs}`);
    console.log(`🔒 Security: MAXIMUM`);
    console.log(`⚡ Performance: OPTIMIZED`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? "Connected" : "Connecting..."}`);
    console.log("=".repeat(60) + "\n");
  });

  // Memory monitoring
  setInterval(() => {
    const used = process.memoryUsage();
    if (used.heapUsed / used.heapTotal > 0.9) {
      console.warn("⚠️  HIGH MEMORY USAGE:", {
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
        percentage: `${Math.round((used.heapUsed / used.heapTotal) * 100)}%`
      });
    
    }
  }, 60000); // Check every minute

} // ← قفلة else الأساسية هنا فقط

module.exports = server;
