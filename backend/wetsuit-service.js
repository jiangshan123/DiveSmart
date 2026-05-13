/**
 * Rough wetsuit thickness (3 / 5 / 7 mm) from air temperature + wind.
 * MeteoSource does not expose sea temperature in our integration — we estimate
 * coastal water as a few °C below air, adjusted for latitude (NZ) and wind chill on the surface.
 */

function toFiniteNumber(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} weatherData - shape from weather-service (current + optional hourly)
 * @param {number} [latitude] - WGS84, for regional sea bias
 * @returns {object|null}
 */
function recommendWetsuit(weatherData, latitude) {
  const cur = weatherData?.current || {};
  const airNow = toFiniteNumber(cur.temperature);
  const wind = Math.max(0, toFiniteNumber(cur.wind_speed) || 0);

  if (airNow == null) return null;

  /** Conservative: use the lower of now and next few hours' air if hourly exists. */
  let air = airNow;
  const hourly = weatherData?.hourly;
  if (Array.isArray(hourly) && hourly.length >= 4) {
    const temps = hourly
      .slice(0, 8)
      .map((h) => toFiniteNumber(h.temperature))
      .filter((t) => t != null);
    if (temps.length) {
      air = Math.min(airNow, Math.min(...temps));
    }
  }

  /** Rough sea-surface proxy (°C): usually a bit below air on mild NZ coast days. */
  let waterEst = air - 2;

  if (typeof latitude === "number" && Number.isFinite(latitude)) {
    if (latitude < -45) waterEst -= 1.8;
    else if (latitude < -42) waterEst -= 1.2;
    else if (latitude < -40) waterEst -= 0.6;
    else if (latitude > -35) waterEst += 0.8;
    else if (latitude > -37) waterEst += 0.4;
  }

  /** Surface wind: faster heat loss before/after the dive. */
  const windPenalty = wind > 5 ? Math.min(3.8, (wind - 5) * 0.38) : 0;
  const effective = waterEst - windPenalty;

  let recommendedMm;
  let label;
  let summary;

  if (effective >= 19) {
    recommendedMm = 3;
    label = "3 mm";
    summary =
      "Warm profile — 3 mm full suit (or shorty for very short dives) is usually enough.";
  } else if (effective >= 12) {
    recommendedMm = 5;
    label = "5 mm";
    summary =
      "Cool water — 5 mm full wetsuit is a solid default; add hood/boots if you run cold.";
  } else if (effective >= 6) {
    recommendedMm = 7;
    label = "7 mm";
    summary =
      "Cold exposure — 7 mm or semi-dry; hood, boots, and gloves strongly recommended.";
  } else {
    recommendedMm = 7;
    label = "7 mm";
    summary =
      "Very cold — 7 mm minimum with full thermal extras; a drysuit may suit better.";
  }

  /** Borderline: suggest alternative */
  let alt = null;
  if (effective >= 17 && effective < 19) {
    alt = "Borderline: consider 5 mm if you chill easily or plan a long dive.";
  } else if (effective >= 10 && effective < 12) {
    alt = "Borderline: 7 mm if second dive, long bottom time, or low activity.";
  }

  return {
    recommended_mm: recommendedMm,
    label,
    summary,
    alt_hint: alt,
    estimated_effective_c: Math.round(effective * 10) / 10,
    air_temp_used_c: Math.round(air * 10) / 10,
    wind_speed_ms: Math.round(wind * 10) / 10,
    note: "Estimate from air temperature and wind (no live sea-temperature feed). Check local buoy or dive shop when possible.",
  };
}

module.exports = {
  recommendWetsuit,
};
