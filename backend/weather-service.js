const axios = require("axios");

const METEOSOURCE_API_BASE = "https://www.meteosource.com/api/v1/free";

/**
 * Get weather data
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 * @param {string} apiKey - MeteoSource API key
 * @returns {Promise<Object>} Weather data
 */
async function getWeather(lat, long, apiKey) {
  if (!apiKey) {
    throw new Error("MeteoSource API key is required");
  }

  try {
    const response = await axios.get(`${METEOSOURCE_API_BASE}/point`, {
      params: {
        lat: lat,
        lon: long,
      },
      headers: {
        "X-API-Key": apiKey,
      },
      timeout: 10000,
    });

    // Format data, return only essential info
    const current = response.data.current || {};
    const hourlyData = response.data.hourly?.data || [];
    const hourly = hourlyData.slice(0, 6); // Next 6 hours
    return {
      location: {
        latitude: lat,
        longitude: long,
      },
      current: {
        temperature: current.temperature,
        wind_speed: current.wind?.speed,
        wind_direction: current.wind?.dir,
        humidity: current.humidity,
        summary: current.summary,
        icon: current.icon,
        cloud_cover: current.cloud_cover,
      },
      hourly: hourly.map((h) => ({
        time: h.time,
        temperature: h.temperature,
        summary: h.summary,
        wind_speed: h.wind?.speed,
        cloud_cover: h.cloud_cover,
      })),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Weather] Fetch failed:", error.message);

    if (error.response?.status === 401) {
      throw new Error("Invalid MeteoSource API key");
    } else if (error.response?.status === 429) {
      throw new Error("Weather API rate limit exceeded");
    }

    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

module.exports = {
  getWeather,
};
