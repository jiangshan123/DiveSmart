// divespot-adapter.js - DynamoDB adapter for dive spots and cache data
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const DIVESPOT_TABLE = "smartdive-dive-spots";
const CACHE_TABLE = "smartdive-weather-tide-cache";

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

console.log(`[DiveSpot Adapter] Initializing DynamoDB adapter`);
console.log(`  - Dive spot table: ${DIVESPOT_TABLE}`);
console.log(`  - Cache table: ${CACHE_TABLE}`);

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeFacingFromItem(item) {
  const raw =
    item.facing_direction ??
    item.facingDirection ??
    item.facing ??
    item.FacingDirection ??
    item.bearing ??
    item.Bearing;
  return toFiniteNumber(raw);
}

/** Initial bearing from (lat1,lon1) to (lat2,lon2), degrees 0–360 clockwise from N. */
function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Rough NZ coastal seaward bearing when DB has no facing (Tasman vs Pacific).
 * Not a substitute for surveyed site bearing.
 */
function estimateSeawardFacingNz(lat, lon) {
  const la = toFiniteNumber(lat);
  const lo = toFiniteNumber(lon);
  if (la == null || lo == null) return null;
  if (la > -28 || la < -49 || lo < 165 || lo > 182) return null;
  const threshold = la < -41 ? 171.5 : 174.85;
  const westRefLon = 166.2;
  const eastRefLon = 179.5;
  if (lo < threshold) {
    return Math.round(bearingDeg(la, lo, la, westRefLon));
  }
  return Math.round(bearingDeg(la, lo, la, eastRefLon));
}

function normalizeStringList(raw) {
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) {
    const out = raw.map((s) => String(s).trim()).filter(Boolean);
    return out.length ? out : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return null;
}

function normalizeBoatRequired(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).toLowerCase().trim();
  if (["yes", "y", "true", "1", "required"].includes(s)) return "yes";
  if (["no", "n", "false", "0", "shore", "shore only"].includes(s)) return "no";
  if (["optional", "maybe", "sometimes"].includes(s)) return "optional";
  return String(raw);
}

/**
 * Normalize a DynamoDB item for REST/frontend: items use camelCase
 * (facingDirection, depthMaxMeters, difficultyLevel) while clients expect snake_case.
 */
function toApiDiveSpot(item) {
  if (!item) return null;
  const parsedFacing = normalizeFacingFromItem(item);
  const estFacing = estimateSeawardFacingNz(item.latitude, item.longitude);
  const facing = parsedFacing ?? estFacing;

  return {
    spotId: item.spotId,
    name: item.name,
    region: item.region,
    latitude: item.latitude,
    longitude: item.longitude,
    description: item.description ?? null,
    facing_direction: facing,
    facing_direction_estimated:
      parsedFacing == null && estFacing != null && facing != null,
    depth_max_meters:
      toFiniteNumber(item.depth_max_meters ?? item.depthMaxMeters) ?? null,
    difficulty_level:
      item.difficulty_level ?? item.difficultyLevel ?? null,
    suitable_for: normalizeStringList(
      item.suitable_for ?? item.suitableFor ?? item.activities,
    ),
    getting_there:
      item.getting_there ?? item.gettingThere ?? item.directions ?? null,
    parking_location:
      item.parking_location ?? item.parkingLocation ?? item.parking ?? null,
    boat_required: normalizeBoatRequired(
      item.boat_required ?? item.boatRequired,
    ),
    parking_to_entry_walk:
      item.parking_to_entry_walk ??
      item.parkingToEntryWalk ??
      item.shore_walk ??
      null,
    access_notes:
      item.access_notes ?? item.accessNotes ?? item.accessExtra ?? null,
    createdAt: item.createdAt,
  };
}

// ===== Dive spot operations =====
const spotOps = {
  // Get all dive spots
  async getAllSpots() {
    try {
      const command = new ScanCommand({
        TableName: DIVESPOT_TABLE,
      });
      const response = await docClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error("[DiveSpot] Failed to scan dive spots:", error.message);
      throw error;
    }
  },

  // Get dive spot by ID
  async getSpotById(spotId) {
    try {
      const command = new GetCommand({
        TableName: DIVESPOT_TABLE,
        Key: { spotId: spotId },
      });
      const response = await docClient.send(command);
      return response.Item || null;
    } catch (error) {
      console.error("[DiveSpot] Failed to get dive spot:", error.message);
      throw error;
    }
  },

  // Get dive spots by region
  async getSpotsByRegion(region) {
    try {
      const command = new QueryCommand({
        TableName: DIVESPOT_TABLE,
        IndexName: "region-index",
        KeyConditionExpression: "#region = :region",
        ExpressionAttributeNames: {
          "#region": "region",
        },
        ExpressionAttributeValues: {
          ":region": region,
        },
      });
      const response = await docClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error("[DiveSpot] Failed to query dive spots by region:", error.message);
      throw error;
    }
  },

  // Create dive spot
  async createSpot(spotData) {
    try {
      const command = new PutCommand({
        TableName: DIVESPOT_TABLE,
        Item: {
          spotId: spotData.id,
          name: spotData.name,
          region: spotData.region,
          latitude: spotData.latitude,
          longitude: spotData.longitude,
          facingDirection: spotData.facing_direction,
          depthMaxMeters: spotData.depth_max_meters,
          difficultyLevel: spotData.difficulty_level,
          description: spotData.description,
          suitableFor: spotData.suitable_for,
          gettingThere: spotData.getting_there,
          parkingLocation: spotData.parking_location,
          boatRequired: spotData.boat_required,
          parkingToEntryWalk: spotData.parking_to_entry_walk,
          accessNotes: spotData.access_notes,
          createdAt: Math.floor(
            new Date(spotData.created_at || new Date()).getTime() / 1000,
          ),
        },
      });

      await docClient.send(command);
      return spotData;
    } catch (error) {
      console.error("[DiveSpot] Failed to create dive spot:", error.message);
      throw error;
    }
  },

  // Update dive spot
  async updateSpot(spotId, updates) {
    try {
      const updateExpressions = [];
      const expressionValues = {};

      Object.keys(updates).forEach((key) => {
        updateExpressions.push(`${key} = :${key}`);
        expressionValues[`:${key}`] = updates[key];
      });

      const command = new UpdateCommand({
        TableName: DIVESPOT_TABLE,
        Key: { spotId: spotId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: "ALL_NEW",
      });

      const response = await docClient.send(command);
      return response.Attributes;
    } catch (error) {
      console.error("[DiveSpot] Failed to update dive spot:", error.message);
      throw error;
    }
  },

  // Delete dive spot
  async deleteSpot(spotId) {
    try {
      const command = new DeleteCommand({
        TableName: DIVESPOT_TABLE,
        Key: { spotId: spotId },
      });

      await docClient.send(command);
      return true;
    } catch (error) {
      console.error("[DiveSpot] Failed to delete dive spot:", error.message);
      throw error;
    }
  },
};

// ===== Cache operations =====
const cacheOps = {
  // Get latest cache for a dive spot
  async getLatestCache(spotId) {
    try {
      const command = new QueryCommand({
        TableName: CACHE_TABLE,
        KeyConditionExpression: "spotId = :spotId",
        ExpressionAttributeValues: {
          ":spotId": spotId,
        },
        ScanIndexForward: false, // Descending order, newest first
        Limit: 1,
      });

      const response = await docClient.send(command);
      return response.Items && response.Items.length > 0
        ? response.Items[0]
        : null;
    } catch (error) {
      console.error("[Cache] Failed to get latest cache:", error.message);
      throw error;
    }
  },

  // Get valid cache (not expired)
  async getValidCache(spotId) {
    try {
      const now = Math.floor(Date.now()); // Millisecond timestamp

      const command = new QueryCommand({
        TableName: CACHE_TABLE,
        KeyConditionExpression: "spotId = :spotId",
        FilterExpression: "expiresAt > :now",
        ExpressionAttributeValues: {
          ":spotId": spotId,
          ":now": now,
        },
        ScanIndexForward: false,
        Limit: 1,
      });

      const response = await docClient.send(command);
      return response.Items && response.Items.length > 0
        ? response.Items[0]
        : null;
    } catch (error) {
      console.error("[Cache] Failed to get valid cache:", error.message);
      throw error;
    }
  },

  // Get all cache records (for cleanup)
  async getAllCache() {
    try {
      const command = new ScanCommand({
        TableName: CACHE_TABLE,
      });
      const response = await docClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error("[Cache] Failed to scan cache:", error.message);
      throw error;
    }
  },

  // Save cache
  async saveCache(cacheData) {
    try {
      const now = Math.floor(Date.now()); // Millisecond timestamp

      const command = new PutCommand({
        TableName: CACHE_TABLE,
        Item: {
          spotId: cacheData.dive_spot_id,
          cachedAt: now,
          expiresAt: cacheData.expires_at
            ? Math.floor(
                new Date(cacheData.expires_at.replace(" ", "T")).getTime(),
              )
            : now + 6 * 60 * 60 * 1000, // Default: expire in 6 hours (ms)
          latitude: cacheData.latitude,
          longitude: cacheData.longitude,
          tideData: cacheData.tide_data,
          weatherData: cacheData.weather_data,
          tideSource: cacheData.tide_source || "NIWA",
          weatherSource: cacheData.weather_source || "PROVIDER",
        },
      });

      await docClient.send(command);
      return true;
    } catch (error) {
      console.error("[Cache] Failed to save cache:", error.message);
      throw error;
    }
  },

  // Clean expired cache
  async cleanExpiredCache() {
    try {
      const now = Math.floor(Date.now()); // Millisecond timestamp
      const allCache = await this.getAllCache();

      let deletedCount = 0;

      for (const cache of allCache) {
        if (cache.expiresAt < now) {
          const command = new DeleteCommand({
            TableName: CACHE_TABLE,
            Key: {
              spotId: cache.spotId,
              cachedAt: cache.cachedAt,
            },
          });

          await docClient.send(command);
          deletedCount++;
        }
      }

      console.log(`[Cache] Cleaned expired records: ${deletedCount}`);
      return deletedCount;
    } catch (error) {
      console.error("[Cache] Failed to clean expired cache:", error.message);
      throw error;
    }
  },

  // Delete all cache records for a dive spot
  async deleteSpotCache(spotId) {
    try {
      const command = new QueryCommand({
        TableName: CACHE_TABLE,
        KeyConditionExpression: "spotId = :spotId",
        ExpressionAttributeValues: {
          ":spotId": spotId,
        },
      });

      const response = await docClient.send(command);
      const items = response.Items || [];

      for (const item of items) {
        const deleteCommand = new DeleteCommand({
          TableName: CACHE_TABLE,
          Key: {
            spotId: item.spotId,
            cachedAt: item.cachedAt,
          },
        });

        await docClient.send(deleteCommand);
      }

      return items.length;
    } catch (error) {
      console.error("[Cache] Failed to delete dive spot cache:", error.message);
      throw error;
    }
  },
};

// Export adapter
module.exports = {
  spots: spotOps,
  cache: cacheOps,
  toApiDiveSpot,
};
