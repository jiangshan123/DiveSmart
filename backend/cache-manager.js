// cache-manager.js - DynamoDB Cache Manager
const dvAdapter = require("./divespot-adapter");
const tideService = require("./tide-service.js");
const weatherService = require("./weather-service.js");

/**
 * Refresh weather and tide cache for all dive spots
 */
async function refreshAllDiveSpots(niwaApiKey, weatherApiKey) {
  try {
    // 1. Fetch all dive spots
    console.log("[Cache] Fetching all dive spots...");
    const spots = await dvAdapter.spots.getAllSpots();

    if (!spots || spots.length === 0) {
      console.warn("[Cache] No dive spots found");
      return { total: 0, refreshed: 0, failed: 0 };
    }

    console.log(`[Cache] Found ${spots.length} dive spots\n`);

    let refreshed = 0;
    let failed = 0;
    const newEntries = [];

    // 2. Parallel fetch data for all spots
    for (const spot of spots) {
      try {
        console.log(
          `[Cache] Fetching data for spot #${spot.spotId}: ${spot.name}...`,
        );

        const [tideData, weatherData] = await Promise.all([
          tideService.getTideForecast(
            spot.latitude,
            spot.longitude,
            niwaApiKey,
          ),
          weatherService.getWeather(
            spot.latitude,
            spot.longitude,
            weatherApiKey,
          ),
        ]);

        newEntries.push({
          dive_spot_id: spot.spotId,
          latitude: spot.latitude,
          longitude: spot.longitude,
          tide_data: JSON.stringify(tideData),
          weather_data: JSON.stringify(weatherData),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          tide_source: "NIWA",
          weather_source: "PROVIDER",
        });

        refreshed++;
        console.log(`[Cache] ✓ Spot #${spot.spotId} data ready`);

        // 500ms delay to avoid API rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[Cache] ✗ Spot #${spot.spotId} failed: ${err.message}`);
        failed++;
      }
    }

    // 3. Clean expired cache
    if (refreshed > 0) {
      console.log(`\n[Cache] Cleaning expired cache...`);
      const cleanedCount = await dvAdapter.cache.cleanExpiredCache();
      console.log(`[Cache] Cleaned ${cleanedCount} expired records`);

      // 4. Save new cache
      console.log(`[Cache] Saving ${newEntries.length} new cache entries...`);
      for (const entry of newEntries) {
        await dvAdapter.cache.saveCache(entry);
      }

      console.log(
        `\n[Cache] ✓ ${refreshed}/${spots.length} dive spots cache refreshed`,
      );
    } else {
      console.warn(
        `[Cache] ⚠ All ${spots.length} spots failed, keeping old cache`,
      );
    }

    const result = { total: spots.length, refreshed, failed };
    console.log(`[Cache] Summary: ${refreshed} succeeded, ${failed} failed`);

    return result;
  } catch (error) {
    console.error("[Cache] Refresh failed:", error.message);
    console.warn("[Cache] ⚠ Keeping old cache");
    throw error;
  }
}

/**
 * Get cache statistics
 */
async function getCacheInfo() {
  try {
    const allCache = await dvAdapter.cache.getAllCache();

    // Count valid and expired cache entries
    const now = Math.floor(Date.now()); // milliseconds timestamp
    let validCount = 0;
    let expiredCount = 0;

    for (const item of allCache) {
      if (item.expiresAt > now) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    // Get latest cache timestamp
    const latestCache =
      allCache.length > 0
        ? allCache.reduce((prev, current) =>
            current.cachedAt > prev.cachedAt ? current : prev,
          )
        : null;

    return {
      total_records: allCache.length,
      valid_records: validCount,
      expired_records: expiredCount,
      last_updated: latestCache
        ? new Date(latestCache.cachedAt).toISOString()
        : null,
      records: allCache,
    };
  } catch (error) {
    console.error("[Cache] Failed to get info:", error.message);
    throw error;
  }
}

/**
 * Start daily refresh timer
 * Executes every 24 hours, runs immediately on start
 */
function startDailyRefresh(niwaApiKey, weatherApiKey) {
  // Refresh immediately on startup
  (async () => {
    try {
      console.log("[Cache] Starting initial cache refresh...");
      await refreshAllDiveSpots(niwaApiKey, weatherApiKey);
    } catch (error) {
      console.error("[Cache] Initial refresh failed:", error.message);
    }
  })();

  // Then refresh every 24 hours
  const refreshInterval = setInterval(
    async () => {
      try {
        console.log("\n[Cache] Running daily scheduled refresh...");
        await refreshAllDiveSpots(niwaApiKey, weatherApiKey);
      } catch (error) {
        console.error("[Cache] Scheduled refresh failed:", error.message);
      }
    },
    24 * 60 * 60 * 1000,
  );

  return refreshInterval;
}

/**
 * Stop the timer
 */
function stopDailyRefresh(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log("[Cache] Timer stopped");
  }
}

module.exports = {
  refreshAllDiveSpots,
  getCacheInfo,
  startDailyRefresh,
  stopDailyRefresh,
};
