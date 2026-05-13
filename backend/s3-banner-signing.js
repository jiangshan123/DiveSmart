/**
 * Presign S3 banner URLs so browsers can load images from private buckets.
 * Set S3_BANNER_BUCKET=divingspotbanner (and ensure IAM has s3:GetObject on that bucket).
 */
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const clientsByRegion = new Map();

function getS3Client(region) {
  const r = region || process.env.AWS_REGION || "us-east-1";
  if (!clientsByRegion.has(r)) {
    clientsByRegion.set(r, new S3Client({ region: r }));
  }
  return clientsByRegion.get(r);
}

/** Parse common HTTPS S3 object URLs into { bucket, region, key }. */
function parseS3ObjectUrl(href) {
  if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return null;
  try {
    const u = new URL(href.trim());
    const host = u.hostname;
    let m = host.match(/^([^.]+)\.s3\.([a-z0-9-]+)\.amazonaws\.com$/i);
    if (m) {
      const key = u.pathname.replace(/^\//, "");
      if (!key) return null;
      return { bucket: m[1], region: m[2], key: decodeURIComponent(key) };
    }
    m = host.match(/^([^.]+)\.s3\.amazonaws\.com$/i);
    if (m) {
      const key = u.pathname.replace(/^\//, "");
      if (!key) return null;
      return { bucket: m[1], region: "us-east-1", key: decodeURIComponent(key) };
    }
    const m2 = host.match(/^s3\.([a-z0-9-]+)\.amazonaws\.com$/i);
    if (m2) {
      const parts = u.pathname.replace(/^\//, "").split("/");
      const bucket = parts[0];
      const key = parts.slice(1).join("/");
      if (!bucket || !key) return null;
      return {
        bucket,
        region: m2[1],
        key: decodeURIComponent(key),
      };
    }
  } catch (_) {
    return null;
  }
  return null;
}

function shouldSignForBucket(parsed) {
  const allowed = (process.env.S3_BANNER_BUCKET || "").trim();
  if (!allowed) return false;
  return parsed.bucket === allowed;
}

function shouldSignForAvatarBucket(parsed) {
  const allowed = (process.env.S3_AVATAR_BUCKET || "").trim();
  if (!allowed) return false;
  return parsed.bucket === allowed;
}

async function signBannerImageUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return urls;
  if (!(process.env.S3_BANNER_BUCKET || "").trim()) return urls;

  const expiresIn = Math.min(
    Math.max(parseInt(process.env.S3_BANNER_URL_EXPIRY_SEC || "3600", 10) || 3600, 60),
    604800,
  );
  const out = [];
  for (const href of urls) {
    const parsed = parseS3ObjectUrl(String(href));
    if (!parsed || !shouldSignForBucket(parsed)) {
      out.push(href);
      continue;
    }
    try {
      const client = getS3Client(parsed.region);
      const cmd = new GetObjectCommand({
        Bucket: parsed.bucket,
        Key: parsed.key,
      });
      const signed = await getSignedUrl(client, cmd, { expiresIn });
      out.push(signed);
    } catch (err) {
      console.warn(
        `[S3 banner] Presign failed for ${parsed.bucket}/${parsed.key}:`,
        err.message,
      );
      out.push(href);
    }
  }
  return out;
}

async function attachSignedBannerUrlsToSpot(spot) {
  if (!spot || !spot.banner_image_urls?.length) return spot;
  const signed = await signBannerImageUrls(spot.banner_image_urls);
  return { ...spot, banner_image_urls: signed };
}

async function attachSignedBannerUrlsToSpots(spots) {
  if (!Array.isArray(spots)) return spots;
  return Promise.all(spots.map((s) => attachSignedBannerUrlsToSpot(s)));
}

/** Presign a single avatar URL when it lives in S3_AVATAR_BUCKET (private objects). */
async function signAvatarImageUrl(href) {
  if (typeof href !== "string" || !href.trim()) return href;
  if (!(process.env.S3_AVATAR_BUCKET || "").trim()) return href;

  const expiresIn = Math.min(
    Math.max(
      parseInt(process.env.S3_AVATAR_URL_EXPIRY_SEC || "3600", 10) || 3600,
      60,
    ),
    604800,
  );
  const parsed = parseS3ObjectUrl(String(href));
  if (!parsed || !shouldSignForAvatarBucket(parsed)) {
    return href;
  }
  try {
    const client = getS3Client(parsed.region);
    const cmd = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });
    return await getSignedUrl(client, cmd, { expiresIn });
  } catch (err) {
    console.warn(
      `[S3 avatar] Presign failed for ${parsed.bucket}/${parsed.key}:`,
      err.message,
    );
    return href;
  }
}

module.exports = {
  parseS3ObjectUrl,
  signBannerImageUrls,
  attachSignedBannerUrlsToSpot,
  attachSignedBannerUrlsToSpots,
  signAvatarImageUrl,
};
