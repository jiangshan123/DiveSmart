const express = require("express");
const cors = require("cors");
const tideService = require("./tide-service.js");
const weatherService = require("./weather-service.js");
const visibilityService = require("./visibility-service.js");
const cacheManager = require("./cache-manager.js");
const authService = require("./auth-service.js");
const diveSpotAdapter = require("./divespot-adapter.js");

const app = express();
const port = process.env.PORT || 8080;
const niwaApiKey = process.env.NIWA_API_KEY;
const weatherApiKey = process.env.METEOSOURCE_API_KEY;
let cacheRefreshInterval = null;

// Middleware
app.use(cors());
app.use(express.json());

// ===== Helper Functions =====

// Handle Supabase query results
const handleQuery = (error, data) => {
  if (error) throw error;
  return data;
};

// Standard response format
const respondSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({ success: true, data });
};

const respondError = (res, error, statusCode = 500) => {
  res
    .status(statusCode)
    .json({ success: false, error: error.message || error });
};

// ===== Basic Routes ====="

app.get("/", (req, res) => {
  respondSuccess(res, {
    message: "SmartDive backend running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  respondSuccess(res, {
    status: "healthy",
    service: "SmartDive Backend",
    uptime: process.uptime(),
  });
});

// ===== User Authentication API =====

// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Validate input
    if (!email || !password) {
      return respondError(res, "Email and password are required", 400);
    }

    if (password.length < 6) {
      return respondError(res, "Password must be at least 6 characters", 400);
    }

    const result = await authService.registerUser(email, password, username);

    if (result.success) {
      respondSuccess(res, result, 201);
    } else {
      respondError(res, result.error, 400);
    }
  } catch (err) {
    respondError(res, err);
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return respondError(res, "Email and password are required", 400);
    }

    const result = await authService.loginUser(email, password);

    if (result.success) {
      respondSuccess(res, result);
    } else {
      respondError(res, result.error, 401);
    }
  } catch (err) {
    respondError(res, err);
  }
});

// Get Current User Info
app.get("/api/auth/me", authService.authMiddleware, async (req, res) => {
  try {
    const result = await authService.getUserInfo(req.user.id);

    if (result.success) {
      respondSuccess(res, result.user);
    } else {
      respondError(res, result.error, 404);
    }
  } catch (err) {
    respondError(res, err);
  }
});

// Verify Token
app.post("/api/auth/verify", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return respondError(res, "Missing authentication token", 401);
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return respondError(res, "Invalid or expired token", 401);
    }

    respondSuccess(res, { valid: true, user: decoded });
  } catch (err) {
    respondError(res, err);
  }
});

// ===== Dive Spots API =====

// Get all dive spots or filter by difficulty
app.get("/api/dive-spots", async (req, res) => {
  try {
    const { difficulty } = req.query;

    // Fetch all dive spots from DynamoDB
    let spots = await diveSpotAdapter.spots.getAllSpots();
    spots = spots.map((s) => diveSpotAdapter.toApiDiveSpot(s));

    // Filter by difficulty if provided (string level, e.g. Advanced)
    if (difficulty) {
      spots = spots.filter(
        (spot) => spot.difficulty_level === difficulty,
      );
    }

    // Sort by creation time in descending order
    spots.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    respondSuccess(res, { spots: spots, count: spots.length });
  } catch (err) {
    respondError(res, err);
  }
});

// Get single dive spot
app.get("/api/dive-spots/:id", async (req, res) => {
  try {
    const spotId = parseInt(req.params.id);

    // Validate spotId
    if (isNaN(spotId)) {
      return respondError(res, "Invalid spot ID", 400);
    }

    const spot = await diveSpotAdapter.spots.getSpotById(spotId);

    if (!spot) {
      return respondError(res, "Dive spot not found", 404);
    }

    respondSuccess(res, diveSpotAdapter.toApiDiveSpot(spot));
  } catch (err) {
    respondError(res, err, 500);
  }
});

// ===== Combined API =====

// Get tide + weather data (combined)
app.get("/api/conditions", async (req, res) => {
  try {
    let lat, long, spotId, spotData;
    const { lat: queryLat, long: queryLong, spotId: querySpotId } = req.query;

    // Get coordinates and spot data
    if (querySpotId) {
      const parsedSpotId = parseInt(querySpotId);

      // Validate spotId
      if (isNaN(parsedSpotId)) {
        return respondError(res, "Invalid spot ID", 400);
      }

      const rawSpot = await diveSpotAdapter.spots.getSpotById(parsedSpotId);

      if (!rawSpot) {
        return respondError(res, "Dive spot not found", 404);
      }
      spotData = diveSpotAdapter.toApiDiveSpot(rawSpot);
      lat = spotData.latitude;
      long = spotData.longitude;
      spotId = spotData.spotId;
    } else if (queryLat && queryLong) {
      lat = parseFloat(queryLat);
      long = parseFloat(queryLong);
    } else {
      return respondError(res, "Requires spotId or lat/long parameters", 400);
    }

    // Check API keys
    if (!niwaApiKey || !weatherApiKey) {
      return respondError(res, "API keys not configured", 500);
    }

    // Fetch tide and weather data in parallel
    const [tideData, weatherData] = await Promise.all([
      tideService.getTideForecast(lat, long, niwaApiKey),
      weatherService.getWeather(lat, long, weatherApiKey),
    ]);

    // Save to DynamoDB cache automatically
    if (spotId) {
      await diveSpotAdapter.cache.saveCache({
        dive_spot_id: spotId,
        latitude: lat,
        longitude: long,
        tide_data: JSON.stringify(tideData),
        weather_data: JSON.stringify(weatherData),
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Calculate underwater visibility prediction
    const visibility = visibilityService.calculateVisibility(
      weatherData,
      tideData,
      spotData,
    );

    respondSuccess(res, {
      location: { latitude: lat, longitude: long },
      tide: tideData,
      weather: weatherData,
      visibility: visibility,
      cached_time: new Date().toISOString(),
    });
  } catch (err) {
    respondError(res, err);
  }
});

// ===== Cache Management Endpoints (Admin) =====

// Manually refresh all cache
app.post("/api/admin/cache/refresh-all", async (req, res) => {
  try {
    if (!niwaApiKey || !weatherApiKey) {
      return respondError(res, "API keys not configured", 500);
    }

    await cacheManager.refreshAllDiveSpots(niwaApiKey, weatherApiKey);
    respondSuccess(res, { message: "Cache refreshed successfully" });
  } catch (err) {
    respondError(res, err);
  }
});

// Get cache info
app.get("/api/admin/cache/info", async (req, res) => {
  try {
    const caches = await diveSpotAdapter.cache.getAllCache();

    // Sort by expiration time in descending order
    caches.sort((a, b) => {
      const timeA = new Date(a.expires_at || 0).getTime();
      const timeB = new Date(b.expires_at || 0).getTime();
      return timeB - timeA;
    });

    respondSuccess(res, {
      cache_count: caches.length,
      caches: caches.map((c) => ({
        dive_spot_id: c.spotId,
        expires_at: c.expires_at,
      })),
      last_refresh: caches[0]?.expires_at || null,
    });
  } catch (err) {
    respondError(res, err);
  }
});

// ===== Server Startup =====

app.listen(port, () => {
  console.log(`✓ Server running at http://localhost:${port}`);

  // Manual cache refresh - use POST /api/admin/cache/refresh-all
  console.log(
    `💡 Tip: Use POST http://localhost:${port}/api/admin/cache/refresh-all to manually refresh cache`,
  );
});
