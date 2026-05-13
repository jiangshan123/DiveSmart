/**
 * Persist user avatar: S3 when S3_AVATAR_BUCKET is set, otherwise local disk under uploads/avatars.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function mimeToExt(mime) {
  return MIME_EXT[mime] || ".bin";
}

function getS3Client() {
  return new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} userId
 * @param {import('express').Request} req
 * @returns {Promise<{ avatarUrl: string }>}
 */
async function persistAvatar(buffer, mimeType, userId, req) {
  const ext = mimeToExt(mimeType);
  const fname = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const bucket = (process.env.S3_AVATAR_BUCKET || "").trim();

  if (bucket) {
    const key = `avatars/${userId}/${fname}`;
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    const region = process.env.AWS_REGION || "us-east-1";
    const avatarUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { avatarUrl };
  }

  const dir = path.join(__dirname, "uploads", "avatars");
  await fs.promises.mkdir(dir, { recursive: true });
  const localName = `${userId}-${fname}`;
  const fullPath = path.join(dir, localName);
  await fs.promises.writeFile(fullPath, buffer);

  const proto =
    (req.headers["x-forwarded-proto"] &&
      String(req.headers["x-forwarded-proto"]).split(",")[0].trim()) ||
    req.protocol ||
    "http";
  const host =
    req.get("host") || `localhost:${process.env.PORT || 8080}`;
  const avatarUrl = `${proto}://${host}/uploads/avatars/${localName}`;
  return { avatarUrl };
}

module.exports = {
  persistAvatar,
  ALLOWED_MIME: Object.keys(MIME_EXT),
};
