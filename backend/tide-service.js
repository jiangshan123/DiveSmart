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
 * Fetch tide forecast data from NIWA API
 * Includes caching to avoid excessive API calls
 * @param {number} lat - Latitude (NZGD1949)
 * @param {number} long - Longitude (NZGD1949)
 * @param {string} apiKey - NIWA API key
 * @returns {Promise<Object>} Tide forecast data
 */
async function getTideForecast(lat, long, apiKey) {
  if (!apiKey) {
    throw new Error("NIWA API key is required");
  }

  const cacheKey = getCacheKey(lat, long);

  // Check cache first
  if (tideCache.has(cacheKey)) {
    const cached = tideCache.get(cacheKey);
    if (isCacheValid(cached.timestamp)) {
      return cached.data;
    } else {
      // Clear expired cache
      tideCache.delete(cacheKey);
    }
  }

  try {
    // 暂时返回模拟数据（NIWA API 需要稍后配置）
    const mockData = {
      region: "New Zealand",
      date: new Date().toISOString().split("T")[0],
      forecasts: [
        {
          time: "06:00",
          prediction: 1.2,
          status: "High",
        },
        {
          time: "12:00",
          prediction: -0.5,
          status: "Low",
        },
        {
          time: "18:00",
          prediction: 1.5,
          status: "High",
        },
      ],
      source: "Mock Data",
    };

    // Cache the response
    tideCache.set(cacheKey, {
      data: mockData,
      timestamp: Date.now(),
    });

    return mockData;
  } catch (error) {
    console.error(`[Tide] 获取失败:`, error.message);
    throw new Error(`Failed to fetch tide data: ${error.message}`);
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
