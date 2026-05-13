/**
 * Forum posts — DynamoDB table smartdive-forum-posts (or FORUM_POSTS_TABLE).
 * Set FORUM_USE_MEMORY=1 to use in-memory store (dev / no table yet).
 */
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const DatabaseAdapter = require("./db-adapter");
const s3BannerSigning = require("./s3-banner-signing");
require("dotenv").config();

const db = DatabaseAdapter.getOperations();

const TABLE = process.env.FORUM_POSTS_TABLE || "smartdive-forum-posts";
const USE_MEMORY = process.env.FORUM_USE_MEMORY === "1";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/** @type {Array<{postId:string,body:string,authorUserId:string,authorUsername:string,createdAt:number}>} */
const memoryPosts = [];

function toApiPost(item) {
  if (!item) return null;
  return {
    post_id: item.postId,
    body: item.body,
    author_username: item.authorUsername ?? "Member",
    author_user_id: item.authorUserId ?? null,
    created_at: item.createdAt,
    author_avatar_url: item.authorAvatarUrl ?? null,
  };
}

async function getSignedAvatarForUserId(userId) {
  if (!userId) return null;
  try {
    const user = await db.getUserById(userId);
    const raw = user?.avatarUrl;
    if (!raw) return null;
    return await s3BannerSigning.signAvatarImageUrl(raw);
  } catch {
    return null;
  }
}

async function attachAuthorAvatars(apiPosts) {
  const list = Array.isArray(apiPosts) ? apiPosts : [];
  const ids = [
    ...new Set(
      list.map((p) => p.author_user_id).filter(Boolean),
    ),
  ];
  const entries = await Promise.all(
    ids.map(async (id) => [id, await getSignedAvatarForUserId(id)]),
  );
  const avatarMap = Object.fromEntries(entries);
  return list.map((p) => ({
    ...p,
    author_avatar_url: p.author_user_id
      ? avatarMap[p.author_user_id] ?? null
      : null,
  }));
}

async function createPost({ body, authorUserId, authorUsername }) {
  const trimmed = String(body || "").trim();
  if (!trimmed) {
    throw new Error("Post content is required");
  }
  if (trimmed.length > 8000) {
    throw new Error("Post is too long (max 8000 characters)");
  }

  const postId = `p_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const createdAt = Date.now();
  const authorUsernameSafe = String(authorUsername || "Member").slice(0, 120);
  const item = {
    postId,
    body: trimmed,
    authorUserId: authorUserId || null,
    authorUsername: authorUsernameSafe,
    createdAt,
  };

  if (USE_MEMORY) {
    memoryPosts.push(item);
    const [out] = await attachAuthorAvatars([toApiPost(item)]);
    return out;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
    }),
  );
  const [out] = await attachAuthorAvatars([toApiPost(item)]);
  return out;
}

/**
 * After linking a legacy Dynamo userId to a Cognito sub, fix post author ids.
 */
async function rewriteAuthorUserId(oldUserId, newUserId) {
  if (!oldUserId || !newUserId || oldUserId === newUserId) return 0;

  if (USE_MEMORY) {
    let n = 0;
    for (const p of memoryPosts) {
      if (p.authorUserId === oldUserId) {
        p.authorUserId = newUserId;
        n += 1;
      }
    }
    return n;
  }

  const res = await docClient.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression: "authorUserId = :o",
      ExpressionAttributeValues: { ":o": oldUserId },
    }),
  );
  const items = res.Items || [];
  let updated = 0;
  for (const item of items) {
    if (!item.postId) continue;
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { postId: item.postId },
        UpdateExpression: "SET authorUserId = :n",
        ExpressionAttributeValues: { ":n": newUserId },
      }),
    );
    updated += 1;
  }
  return updated;
}

async function listPosts(limit = 80) {
  const cap = Math.min(Math.max(parseInt(String(limit), 10) || 80, 1), 200);

  if (USE_MEMORY) {
    const posts = [...memoryPosts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, cap)
      .map(toApiPost);
    return attachAuthorAvatars(posts);
  }

  const res = await docClient.send(
    new ScanCommand({
      TableName: TABLE,
    }),
  );
  const items = res.Items || [];
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const posts = items.slice(0, cap).map(toApiPost);
  return attachAuthorAvatars(posts);
}

if (USE_MEMORY) {
  console.log(
    "[Forum] In-memory post store (FORUM_USE_MEMORY=1). Posts are lost on server restart.",
  );
} else {
  console.log(`[Forum] DynamoDB posts table: ${TABLE}`);
}

module.exports = {
  createPost,
  listPosts,
  toApiPost,
  attachAuthorAvatars,
  rewriteAuthorUserId,
};
