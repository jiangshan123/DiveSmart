/**
 * Underwater Visibility Prediction Service
 * Calculates underwater visibility based on weather and tide conditions
 */

/**
 * Calculate underwater visibility based on weather and tide conditions
 * Now includes analysis of past 48 hours of weather for sediment accumulation prediction
 * @param {Object} weatherData - Weather data with wind_speed, cloud_cover, humidity, hourly array
 * @param {Object} tideData - Tide data with current value (height)
 * @param {Object} spotData - Spot data with facing direction
 * @returns {Object} Visibility prediction
 */
function calculateVisibility(weatherData, tideData, spotData) {
  const weather = weatherData?.current || {};
  const tide = tideData?.values?.[0] || {}; // Get current tide
  const spot = spotData || {};
  const hourlyWeather = weatherData?.hourly || []; // 48-hour weather data

  // Base visibility in meters (NZ coastal average)
  let visibility = 15; // Start with 15m as base

  // Factor 1: Wind Speed (impacts sea state and turbidity)
  // Higher wind = more wave action = poorer visibility
  const windSpeed = weather.wind_speed || 0;
  let windImpact = 0;
  if (windSpeed > 15)
    windImpact = 8; // Strong wind
  else if (windSpeed > 10) windImpact = 5;
  else if (windSpeed > 5) windImpact = 2;

  visibility -= windImpact;

  // Factor 1.5: HISTORICAL WIND ANALYSIS (NEW)
  // If it was windy in the past 24 hours, sediment may still be suspended
  let sedimentPenalty = 0;
  if (hourlyWeather.length > 0) {
    // Get past 24 hours of data (assuming hourly[0-23] is the past 24h)
    const pastHours = hourlyWeather.slice(0, 24);
    const avgWindSpeed =
      pastHours.reduce((sum, h) => sum + (h.wind_speed || 0), 0) /
      (pastHours.length || 1);
    const maxWindSpeed = Math.max(...pastHours.map((h) => h.wind_speed || 0));

    // If average wind was high (> 12 m/s), visibility still impacted by suspended sediment
    if (avgWindSpeed > 12) {
      sedimentPenalty = 3; // Significant suspended sediment
    } else if (avgWindSpeed > 8) {
      sedimentPenalty = 1.5; // Light suspended sediment
    }

    // Very strong winds in past -> heavy sediment impact
    if (maxWindSpeed > 18) {
      sedimentPenalty = Math.max(sedimentPenalty, 4);
    }

    visibility -= sedimentPenalty;
  }

  // Factor 2: Cloud Cover (impacts light penetration)
  const cloudCover = weather.cloud_cover || 50;
  const cloudPenalty = (cloudCover / 100) * 3; // Up to 3m reduction
  visibility -= cloudPenalty;

  // Factor 3: Humidity (high humidity often means rain/poor conditions)
  const humidity = weather.humidity || 60;
  let humidityImpact = 0;
  if (humidity > 85) humidityImpact = 3;
  else if (humidity > 75) humidityImpact = 1;

  visibility -= humidityImpact;

  // Factor 4: Tide influence
  // Spring tides (high values) can stir up sediment
  const tideHeight = tide.value || 1.5;
  let tideImpact = 0;
  if (tideHeight > 2.5) tideImpact = 2; // High tide can reduce visibility
  if (tideHeight < 0.5) tideImpact = 1; // Very low tide exposes shallow areas

  visibility -= tideImpact;

  // Factor 5: Spot facing direction vs wind direction
  // This factor is simplified - properly implemented with wind direction angle
  const facingDirection = spot.facing_direction || null;
  let windDirectionImpact = 0;

  if (
    facingDirection !== null &&
    weather.wind_direction &&
    typeof weather.wind_direction === "number"
  ) {
    // Calculate angle between wind direction and spot facing
    // wind_direction and facing_direction are in degrees (0-360)
    const windDir = weather.wind_direction % 360;
    const spotFacing = facingDirection % 360;
    let angleDiff = Math.abs(windDir - spotFacing);

    // Take shorter angle
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    // Headwind (0-45°): wind blowing toward the spot - worse visibility (1.4x multiplier)
    if (angleDiff <= 45) {
      windDirectionImpact = windImpact * 0.4; // Additional penalty
    }
    // Tailwind (135-180°): wind blowing away from spot - better visibility (0.6x multiplier)
    else if (angleDiff >= 135) {
      windDirectionImpact = -windImpact * 0.4; // Reduction of wind penalty
    }
    // Crosswind (45-135°): medium impact
    // (no additional adjustment needed)
  }

  visibility -= windDirectionImpact;

  // Ensure visibility is within reasonable bounds (NZ waters: 3-30m typically)
  visibility = Math.max(3, Math.min(30, visibility));

  // Round to nearest meter
  visibility = Math.round(visibility);

  // Determine visibility level
  let level = "Poor";
  let color = "#ef4444"; // red
  let rating = 1;

  if (visibility >= 20) {
    level = "Excellent";
    color = "#22c55e"; // green
    rating = 5;
  } else if (visibility >= 15) {
    level = "Good";
    color = "#84cc16"; // lime
    rating = 4;
  } else if (visibility >= 10) {
    level = "Fair";
    color = "#eab308"; // yellow
    rating = 3;
  } else if (visibility >= 5) {
    level = "Poor";
    color = "#f97316"; // orange
    rating = 2;
  }

  // Generate recommendation
  const recommendation = getVisibilityRecommendation(visibility, rating);

  return {
    visibility_meters: visibility,
    level: level,
    color: color,
    rating: rating, // 1-5 stars
    recommendation: recommendation,
    factors: {
      wind_impact: -windImpact,
      sediment_impact: -sedimentPenalty,
      cloud_impact: -Math.round(cloudPenalty),
      humidity_impact: -humidityImpact,
      tide_impact: -tideImpact,
      wind_direction_impact: -Math.round(windDirectionImpact),
    },
    analysis: {
      wind_speed_current: windSpeed,
      wind_speed_24h_avg:
        hourlyWeather.length > 0
          ? (
              hourlyWeather
                .slice(0, 24)
                .reduce((sum, h) => sum + (h.wind_speed || 0), 0) /
              (hourlyWeather.slice(0, 24).length || 1)
            ).toFixed(1)
          : "N/A",
      historical_sediment_impact:
        sedimentPenalty > 0
          ? `${sedimentPenalty}m reduction from past 24h wind`
          : "None",
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get visibility recommendation for divers
 * @param {number} visibility - Visibility in meters
 * @param {number} rating - Rating from 1-5
 * @returns {string} Recommendation text
 */
function getVisibilityRecommendation(visibility, rating) {
  const recommendations = {
    5: `Excellent visibility (${visibility}m) - Perfect for photography and identifying marine life. Ideal conditions!`,
    4: `Good visibility (${visibility}m) - Great for most dives. Good sightlines for spotting features and wildlife.`,
    3: `Fair visibility (${visibility}m) - Acceptable conditions. Stick together and use lights. Some subjects may be hard to see.`,
    2: `Poor visibility (${visibility}m) - Challenging. Use torches, stay close to guide, watch for entanglement risks.`,
    1: `Very poor visibility (${visibility}m) - Not recommended for typical dives. Consider alternative conditions or site.`,
  };

  return recommendations[rating] || recommendations[1];
}

/**
 * Get visual indicator for visibility level
 * Returns stars or percentage
 * @param {number} rating - Rating from 1-5
 * @returns {string} Visual indicator
 */
function getVisibilityIndicator(rating) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  return stars;
}

module.exports = {
  calculateVisibility,
  getVisibilityRecommendation,
  getVisibilityIndicator,
};
