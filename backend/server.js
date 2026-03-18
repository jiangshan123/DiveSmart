const express = require("express");
const cors = require("cors");
const supabase = require("./db.js");
const tideService = require("./tide-service.js");

const app = express();
const port = process.env.PORT || 5000;
const niwaApiKey = process.env.NIWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "SmartDive backend running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Database health check
app.get("/health/db", async (req, res) => {
  try {
    // Use Supabase auth to check connection
    const { data, error } = await supabase.auth.getSession();
    // Connection is normal even without session
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      connection: "supabase-api",
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: err.message,
    });
  }
});

// API health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SmartDive Backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Get all dive spots
app.get("/api/dive-spots", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dive_spots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data,
      count: data.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get dive spots by difficulty
app.get("/api/dive-spots/difficulty/:level", async (req, res) => {
  try {
    const { level } = req.params;
    const { data, error } = await supabase
      .from("dive_spots")
      .select("*")
      .eq("difficulty_level", level)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data,
      count: data.length,
      difficulty: level,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get single dive spot by ID
app.get("/api/dive-spots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("dive_spots")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ===== TIDE API ENDPOINTS =====

// Get tide forecast for a location
app.get("/api/tide/forecast", async (req, res) => {
  try {
    const { lat, long } = req.query;

    if (!lat || !long) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: lat and long",
      });
    }

    if (!niwaApiKey) {
      return res.status(500).json({
        success: false,
        error: "NIWA API key not configured",
      });
    }

    const tideData = await tideService.getTideForecast(
      parseFloat(lat),
      parseFloat(long),
      niwaApiKey,
    );

    res.json({
      success: true,
      data: tideData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get tide forecast for a dive spot by ID
app.get("/api/tide/dive-spot/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!niwaApiKey) {
      return res.status(500).json({
        success: false,
        error: "NIWA API key not configured",
      });
    }

    // Get dive spot location
    const { data: diveSpot, error: spotError } = await supabase
      .from("dive_spots")
      .select("*")
      .eq("id", id)
      .single();

    if (spotError) throw spotError;

    if (!diveSpot) {
      return res.status(404).json({
        success: false,
        error: "Dive spot not found",
      });
    }

    // Get tide forecast for that location
    const tideData = await tideService.getTideForecast(
      diveSpot.latitude,
      diveSpot.longitude,
      niwaApiKey,
    );

    res.json({
      success: true,
      diveSpot: {
        id: diveSpot.id,
        name: diveSpot.name,
        latitude: diveSpot.latitude,
        longitude: diveSpot.longitude,
      },
      tideData: tideData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get tide chart URL for a location
app.get("/api/tide/chart", (req, res) => {
  try {
    const { lat, long, format } = req.query;

    if (!lat || !long) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: lat and long",
      });
    }

    if (!niwaApiKey) {
      return res.status(500).json({
        success: false,
        error: "NIWA API key not configured",
      });
    }

    const chartUrl = tideService.getTideChartUrl(
      parseFloat(lat),
      parseFloat(long),
      format || "svg",
      niwaApiKey,
    );

    res.json({
      success: true,
      url: chartUrl,
      format: format || "svg",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// Cache management endpoints
app.get("/api/tide/cache/stats", (req, res) => {
  try {
    const stats = tideService.getCacheStats();
    res.json({
      success: true,
      cache: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Clear tide cache for specific location or all
app.post("/api/tide/cache/clear", (req, res) => {
  try {
    const { lat, long } = req.body;

    if (lat !== undefined && long !== undefined) {
      tideService.clearCache(parseFloat(lat), parseFloat(long));
      res.json({
        success: true,
        message: `Cache cleared for location ${lat},${long}`,
      });
    } else {
      tideService.clearCache();
      res.json({
        success: true,
        message: "All cache cleared",
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`DB check: http://localhost:${port}/health/db`);
});

// Error handling
server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
