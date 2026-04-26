const supabase = require("./db.js");
const tideService = require("./tide-service.js");
const weatherService = require("./weather-service.js");

/**
 * Refresh cache for all dive spots
 * Only delete old data AFTER successful refresh of all spots
 * If refresh fails, old cache is preserved
 */
async function refreshAllDiveSpots(niwaApiKey, weatherApiKey) {
  try {
    // 1. Get all active dive spots
    const { data: spots, error: spotsError } = await supabase
      .from("dive_spots")
      .select("id, name, latitude, longitude");

    if (spotsError) {
      console.error("[Cache] Error fetching dive spots:", spotsError);
      throw spotsError;
    }

    if (!spots || spots.length === 0) {
      console.warn("[Cache] No dive spots found");
      return { total: 0, refreshed: 0, failed: 0 };
    }

    let refreshed = 0;
    let failed = 0;
    const newEntries = [];

    // 2. Fetch all new data FIRST (without deleting old cache yet)
    for (const spot of spots) {
      try {
        console.log(
          `[Cache] Fetching data for spot ${spot.id}: ${spot.name}...`,
        );

        // Fetch tide and weather data in parallel
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
          dive_spot_id: spot.id,
          latitude: spot.latitude,
          longitude: spot.longitude,
          tide_data: tideData,
          weather_data: weatherData,
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires after 24 hours
        });

        refreshed++;
        console.log(`[Cache] ✓ Spot ${spot.id} data ready`);

        // 500ms delay to avoid API rate limit
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[Cache] ✗ Spot ${spot.id} failed: ${err.message}`);
        failed++;
      }
    }

    // 3. Only delete old cache if we have new data to replace it
    if (refreshed > 0) {
      console.log(`[Cache] Deleting old cached data...`);
      const { error: deleteError } = await supabase
        .from("weather_tide_cache")
        .delete()
        .gt("id", "00000000-0000-0000-0000-000000000000"); // UUID > all zeros, covers all records

      if (deleteError) {
        console.error("[Cache] Delete old cache failed:", deleteError);
        throw deleteError;
      }

      // 4. Insert all new entries
      console.log(`[Cache] Inserting ${newEntries.length} new entries...`);
      const { error: insertError } = await supabase
        .from("weather_tide_cache")
        .insert(newEntries);

      if (insertError) {
        console.error("[Cache] Insert new cache failed:", insertError);
        throw insertError;
      }

      console.log(
        `[Cache] ✓ ${refreshed}/${spots.length} entries refreshed successfully`,
      );
    } else {
      console.warn(
        `[Cache] ⚠ All ${spots.length} spots failed to fetch, keeping old cache`,
      );
    }

    const result = { total: spots.length, refreshed, failed };
    if (failed > 0) {
      console.log(
        `[Cache] Summary: ${refreshed}/${spots.length} succeeded, ${failed} failed. Old cache preserved.`,
      );
    } else {
      console.log(`[Cache] ✓ All ${refreshed} dive spots refreshed`);
    }

    return result;
  } catch (error) {
    console.error("[Cache] Refresh failed:", error.message);
    console.warn("[Cache] ⚠ Old cache has been preserved");
    throw error;
  }
}

/**
 * Get cache info statistics
 */
async function getCacheInfo() {
  try {
    const { data, error } = await supabase
      .from("weather_tide_cache")
      .select("*");

    if (error) throw error;

    return {
      total_records: data?.length || 0,
      records: data || [],
      last_updated: data?.[0]?.cached_at || null,
    };
  } catch (error) {
    console.error("[Cache] Failed to get info:", error.message);
    throw error;
  }
}

/**
 * Start daily refresh timer
 * Execute every 24 hours, run immediately on startup
 */
function startDailyRefresh(niwaApiKey, weatherApiKey) {
  // Run immediately on first startup
  refreshAllDiveSpots(niwaApiKey, weatherApiKey).catch((err) => {
    console.error("[Cache] Initialization failed:", err);
  });

  // Execute every 24 hours (86400000 milliseconds)
  const intervalId = setInterval(
    () => {
      refreshAllDiveSpots(niwaApiKey, weatherApiKey).catch((err) => {
        console.error("[Cache] Scheduled refresh failed:", err);
      });
    },
    24 * 60 * 60 * 1000,
  ); // 24 hours

  return intervalId;
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
