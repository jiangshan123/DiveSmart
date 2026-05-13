/**
 * NZ dive spots from data/nz-spots-batch-seed.json → DynamoDB (smartdive-dive-spots).
 * - New name: Put (new spotId = max+1).
 * - Existing name: Update camelCase fields so Activities & access + metadata match the seed.
 *
 * Requires: AWS credentials + AWS_REGION.
 * Run: npm run seed:nz-spots
 */
const fs = require("fs");
const path = require("path");
const { spots, coerceBannerListForStorage } = require("./divespot-adapter.js");

const DATA = path.join(__dirname, "data", "nz-spots-batch-seed.json");

function loadRows() {
  const raw = fs.readFileSync(DATA, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("Seed file must be a JSON array");
  return rows;
}

/** DynamoDB item attribute names (match createSpot / table schema). */
function rowToDynamoFields(row) {
  const fields = {
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    description: row.description ?? "",
    difficultyLevel: row.difficulty_level ?? null,
    depthMaxMeters: row.depth_max_meters ?? null,
    suitableFor: row.suitable_for ?? null,
    gettingThere: row.getting_there ?? null,
    parkingLocation: row.parking_location ?? null,
    boatRequired: row.boat_required ?? null,
    parkingToEntryWalk: row.parking_to_entry_walk ?? null,
    accessNotes: row.access_notes ?? null,
  };
  const bu = coerceBannerListForStorage(row.banner_image_urls);
  if (bu) fields.bannerImageUrls = bu;
  return fields;
}

function indexByNameLower(items) {
  const m = new Map();
  for (const s of items) {
    const n = String(s.name || "").trim().toLowerCase();
    if (n) m.set(n, s);
  }
  return m;
}

async function main() {
  const rows = loadRows();
  const existing = await spots.getAllSpots();
  const byNameMap = indexByNameLower(existing);
  let maxId = 0;
  for (const s of existing) {
    const id = s.spotId;
    if (typeof id === "number" && id > maxId) maxId = id;
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const name = String(row.name || "").trim();
    if (!name) {
      console.warn("[seed] Skip row without name");
      continue;
    }
    const key = name.toLowerCase();
    const found = byNameMap.get(key);

    if (found) {
      const fields = rowToDynamoFields(row);
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(updates).length === 0) continue;
      await spots.updateSpot(found.spotId, updates);
      updated++;
      console.log(`[seed] Updated spotId=${found.spotId} ${name}`);
      continue;
    }

    maxId += 1;
    const f = rowToDynamoFields(row);
    await spots.createSpot({
      id: maxId,
      name,
      region: f.region,
      latitude: f.latitude,
      longitude: f.longitude,
      facing_direction: row.facing_direction ?? null,
      depth_max_meters: f.depthMaxMeters,
      difficulty_level: f.difficultyLevel,
      description: f.description,
      suitable_for: f.suitableFor,
      getting_there: f.gettingThere,
      parking_location: f.parkingLocation,
      boat_required: f.boatRequired,
      parking_to_entry_walk: f.parkingToEntryWalk,
      access_notes: f.accessNotes,
      banner_image_urls: row.banner_image_urls,
      created_at: new Date().toISOString(),
    });
    byNameMap.set(key, { spotId: maxId, name });
    created++;
    console.log(`[seed] Created spotId=${maxId} ${name}`);
  }

  console.log(`[seed] Done. created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
