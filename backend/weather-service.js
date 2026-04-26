const axios = require("axios");

const METEOSOURCE_API_BASE = "https://www.meteosource.com/api/v1/free";

/**
 * Generate mock weather data for fallback
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 * @returns {Object} Mock weather data
 */
function generateMockWeatherData(lat, long) {
  // Generate realistic mock weather data
  const baseTemp = 15 + Math.random() * 10; // 15-25°C
  const windSpeed = 5 + Math.random() * 15; // 5-20 m/s
  const windDir = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.floor(Math.random() * 8)
  ];
  const humidity = 50 + Math.floor(Math.random() * 40); // 50-90%
  const cloudCover = Math.floor(Math.random() * 100);

  return {
    location: {
      latitude: lat,
      longitude: long,
    },
    current: {
      temperature: parseFloat(baseTemp.toFixed(1)),
      wind_speed: parseFloat(windSpeed.toFixed(1)),
      wind_direction: windDir,
      humidity: humidity,
      summary: "Partly Cloudy",
      icon: "partly_cloudy",
      cloud_cover: cloudCover,
    },
    hourly: Array.from({ length: 48 }, (_, i) => {
      // Include both past (-24h) and future (+24h) data for trend analysis
      const timeOffset = (i - 24) * 3600000; // -24 to +24 hours
      return {
        time: new Date(Date.now() + timeOffset).toISOString(),
        temperature: parseFloat(
          (baseTemp + (Math.random() - 0.5) * 5).toFixed(1),
        ),
        summary: "Variable",
        wind_speed: parseFloat(
          (windSpeed + (Math.random() - 0.5) * 5).toFixed(1),
        ),
        cloud_cover: Math.max(
          0,
          Math.min(100, cloudCover + (Math.random() - 0.5) * 20),
        ),
      };
    }),
    timestamp: new Date().toISOString(),
    _source: "mock",
  };
}

/**
 * Get weather data
 * Falls back to mock data if API fails
 * @param {number} lat - Latitude
 * @param {number} long - Longitude
 * @param {string} apiKey - MeteoSource API key
 * @returns {Promise<Object>} Weather data
 */
async function getWeather(lat, long, apiKey) {
  if (!apiKey) {
    console.warn(`[Weather] No API key, using mock data for ${lat},${long}`);
    return generateMockWeatherData(lat, long);
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
    const hourly = hourlyData.slice(0, 48); // Next 48 hours for trend analysis
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
      _source: "real",
    };
  } catch (error) {
    console.warn(
      `[Weather] API Error (${error.response?.status || "unknown"}): ${error.message}`,
    );

    // Fallback to mock data on any API error
    console.warn(`[Weather] Falling back to mock data for ${lat},${long}`);
    return generateMockWeatherData(lat, long);
  }
}

module.exports = {
  getWeather,
};
