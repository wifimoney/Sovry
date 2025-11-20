console.log('Starting Sovry API Server...');
console.log('Express version:', require('express/package.json').version);

const express = require('express');
const cors = require('cors');

// Note: Worker should be run separately on VPS
// This server only handles API routes
const apiRoutes = require('./routes');

console.log('Dependencies loaded successfully');
console.log('Using routes.js with 8 pools');

const app = express();
const port = process.env.PORT || 3001;

console.log('App created, port:', port);

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development"
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Sovry DEX API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      pools: "GET /api/pools",
      poolChart: "GET /api/pools/:address/chart",
      assetRevenue: "GET /api/assets/:ipId/revenue",
      assetMetadata: "GET /api/assets/:ipId/metadata"
    }
  });
});

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      "GET /health",
      "GET /api/pools",
      "GET /api/pools/:address/chart",
      "GET /api/assets/:ipId/revenue",
      "GET /api/assets/:ipId/metadata"
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  
  const message = process.env.NODE_ENV === "production" 
    ? "Internal server error" 
    : err.message || "Something went wrong";
  
  res.status(err.status || 500).json({
    error: "Internal server error",
    message
  });
});

app.listen(port, () => {
  console.log(`🚀 Sovry DEX API Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 API endpoints: http://localhost:${port}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});
