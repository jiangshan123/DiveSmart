const axios = require("axios");

// Cache for tide data: key = "lat,long", value = { data, timestamp }
const tideCache = new Map();
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const NIWA_API_BASE = "https://api.niwa.co.nz/tides";

// Check if cached data is still valid
function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_DURATION;
}

// Get cache key from coordinates
function getCacheKey(lat, long) {
  return `${lat},${long}`;
}

/**
 * Generate mock tide data for development/fallback
 * Simulates realistic tidal patterns
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 * @returns {Object} Mock tide forecast data
 */
function generateMockTideData(lat, long) {
  const now = new Date();
  const values = [];

  // Generate 48 hours of tide data (2 tidal cycles)
  for (let i = -24; i <= 24; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    // Realistic tide amplitude: ~1.2m, semi-diurnal pattern
    const value = 1.5 + 1.2 * Math.sin((i * Math.PI) / 12.42);
    values.push({
      time: time.toISOString(),
      value: parseFloat(value.toFixed(2)),
    });
  }

  return {
    metadata: {
      latitude: lat,
      longitude: long,
      datum: "Chart Datum",
      start: now.toISOString(),
      days: 2,
      height: "metres",
    },
    values: values,
    _source: "mock", // Mark as mock data
  };
}

/**
 * Fetch tide forecast data from NIWA API
 * Falls back to mock data if API fails or rate limited
 * @param {number} lat - Latitude (NZGD1949)
 * @param {number} long - Longitude (NZGD1949)
 * @param {string} apiKey - NIWA API key
 * @returns {Promise<Object>} Tide forecast data
 */
async function getTideForecast(lat, long, apiKey) {
  if (!apiKey) {
    console.warn(`[Tide] No API key, using mock data for ${lat},${long}`);
    return generateMockTideData(lat, long);
  }

  const cacheKey = getCacheKey(lat, long);

  // Check cache first
  if (tideCache.has(cacheKey)) {
    const cached = tideCache.get(cacheKey);
    if (isCacheValid(cached.timestamp)) {
      console.log(`[Tide] Cache HIT for ${cacheKey}`);
      return cached.data;
    } else {
      // Clear expired cache
      tideCache.delete(cacheKey);
    }
  }

  // Fetch from NIWA API
  try {
    console.log(`[Tide] Fetching from NIWA API for ${cacheKey}...`);
    const response = await axios.get(`${NIWA_API_BASE}/data`, {
      params: {
        lat: lat,
        long: long, // NIWA API parameter name is 'long'
      },
      headers: {
        "x-apikey": apiKey,
        "Accept-Encoding": "gzip, deflate", // Exclude Brotli (br) encoding
      },
      timeout: 15000,
      decompress: true,
    });

    console.log(`[Tide] ✓ Data retrieved from NIWA API`);

    // Cache the response
    tideCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });

    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const faultString = error.response?.data?.fault?.faultstring;
    const errorMsg = faultString || error.message;

    console.warn(`[Tide] API Error (${status}): ${errorMsg}`);

    // If rate limited AND we have cached data, use it
    if (status === 429 && tideCache.has(cacheKey)) {
      const cached = tideCache.get(cacheKey);
      console.warn(
        `[Tide] Rate limit exceeded, using cached data (${Math.round(
          (Date.now() - cached.timestamp) / 60000,
        )}min old)`,
      );
      return cached.data;
    }

    // Fallback to mock data on any API error
    console.warn(
      `[Tide] API call failed, falling back to mock data for ${cacheKey}`,
    );
    return generateMockTideData(lat, long);
  }
}

/**
 * Get tide chart URL (SVG or PNG)
 * @param {number} lat - Latitude (NZGD1949)
 * @param {number} long - Longitude (NZGD1949)
 * @param {string} format - "svg" or "png" (default: "svg")
 * @param {string} apiKey - NIWA API key
 * @returns {string} Chart URL
 */
function getTideChartUrl(lat, long, format = "svg", apiKey) {
  if (!apiKey) {
    throw new Error("NIWA API key is required");
  }

  const validFormats = ["svg", "png"];
  if (!validFormats.includes(format)) {
    format = "svg";
  }

  return `${NIWA_API_BASE}/chart.${format}?lat=${encodeURIComponent(
    lat,
  )}&long=${encodeURIComponent(long)}&apikey=${encodeURIComponent(apiKey)}`;
}

/**
 * Clear cache for a specific location or all cache
 * @param {number} lat - Latitude (optional)
 * @param {number} long - Longitude (optional)
 */
function clearCache(lat, long) {
  if (lat !== undefined && long !== undefined) {
    const cacheKey = getCacheKey(lat, long);
    tideCache.delete(cacheKey);
    console.log(`[Tide Cache] Cleared for ${cacheKey}`);
  } else {
    tideCache.clear();
    console.log(`[Tide Cache] Cleared all cache`);
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return {
    size: tideCache.size,
    entries: Array.from(tideCache.entries()).map(([key, value]) => ({
      location: key,
      cached: new Date(value.timestamp).toISOString(),
      expired: !isCacheValid(value.timestamp),
    })),
  };
}

module.exports = {
  getTideForecast,
  getTideChartUrl,
  clearCache,
  getCacheStats,
};
