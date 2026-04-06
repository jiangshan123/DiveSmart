const express = require("express");
const cors = require("cors");
const supabase = require("./db.js");
const tideService = require("./tide-service.js");
const weatherService = require("./weather-service.js");
const cacheManager = require("./cache-manager.js");

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

// ===== Dive Spots API =====

// Get all dive spots or filter by difficulty
app.get("/api/dive-spots", async (req, res) => {
  try {
    const { difficulty } = req.query;
    let query = supabase.from("dive_spots").select("*");

    // Filter by difficulty if provided
    if (difficulty) {
      query = query.eq("difficulty_level", difficulty);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    const result = handleQuery(error, data);

    respondSuccess(res, { spots: result, count: result.length });
  } catch (err) {
    respondError(res, err);
  }
});

// Get single dive spot
app.get("/api/dive-spots/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("dive_spots")
      .select("*")
      .eq("id", id)
      .single();

    const result = handleQuery(error, data);
    respondSuccess(res, result);
  } catch (err) {
    respondError(res, err, err?.code === "PGRST116" ? 404 : 500);
  }
});

// ===== Combined API =====

// Get tide + weather data (combined)
app.get("/api/conditions", async (req, res) => {
  try {
    let lat, long, spotId;
    const { lat: queryLat, long: queryLong, spotId: querySpotId } = req.query;

    // Get coordinates
    if (querySpotId) {
      const { data: spot, error } = await supabase
        .from("dive_spots")
        .select("id, latitude, longitude")
        .eq("id", querySpotId)
        .single();

      if (error) throw error;
      lat = spot.latitude;
      long = spot.longitude;
      spotId = spot.id;
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

    // Auto-save to cache
    if (spotId) {
      await supabase.from("weather_tide_cache").insert({
        dive_spot_id: spotId,
        latitude: lat,
        longitude: long,
        tide_data: tideData,
        weather_data: weatherData,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }

    respondSuccess(res, {
      location: { latitude: lat, longitude: long },
      tide: tideData,
      weather: weatherData,
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
    const { data, error } = await supabase
      .from("weather_tide_cache")
      .select("dive_spot_id, expires_at")
      .order("expires_at", { ascending: false });

    if (error) throw error;

    respondSuccess(res, {
      cache_count: data.length,
      caches: data,
      last_refresh: data[0]?.expires_at || null,
    });
  } catch (err) {
    respondError(res, err);
  }
});

// ===== Server Startup =====

app.listen(port, () => {
  console.log(`✓ Server running at http://localhost:${port}`);

  // Start daily cache refresh
  if (niwaApiKey && weatherApiKey) {
    cacheRefreshInterval = cacheManager.startDailyRefresh(
      niwaApiKey,
      weatherApiKey,
    );
  }
});
