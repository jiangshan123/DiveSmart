const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const DatabaseAdapter = require("./db-adapter");
const avatarService = require("./avatar-service");
const s3BannerSigning = require("./s3-banner-signing");
const { isCognitoEnabled, verifyCognitoIdToken } = require("./cognito-auth");
const { sendPasswordResetEmail } = require("./password-reset-mail");
const forumAdapter = require("./forum-adapter");
const db = DatabaseAdapter.getOperations();

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const SALT_ROUNDS = 10;
const PASSWORD_RESET_JWT_EXPIRES = "1h";

function getPasswordResetFrontendBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: "7d" });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Verify password
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// User registration
const registerUser = async (email, password, username) => {
  try {
    // Check if email already exists
    const existingUser = await db.getUserByEmail(email);

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user using adapter
    const newUser = await db.createUser({
      id: require("crypto").randomUUID(),
      email,
      password: hashedPassword,
      username: username || email.split("@")[0],
      created_at: new Date().toISOString(),
    });

    // Generate token
    const token = generateToken(newUser.id, newUser.email);

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        avatarUrl: null,
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// User login
const loginUser = async (email, password) => {
  try {
    // Find user using adapter
    const user = await db.getUserByEmail(email);

    if (!user) {
      throw new Error("User does not exist");
    }

    // Verify password (support both 'password' and 'passwordHash' fields)
    const passwordField = user.password || user.passwordHash;
    const passwordMatch = await verifyPassword(password, passwordField);

    if (!passwordMatch) {
      throw new Error("Password is incorrect");
    }

    // Update last login time using adapter
    const userId = user.id || user.userId;
    await db.updateUser(userId, email, {
      last_login: new Date().toISOString(),
    });

    // Generate token
    const token = generateToken(userId, user.email);

    const rawAvatar = user.avatarUrl || null;
    const avatarUrl = rawAvatar
      ? await s3BannerSigning.signAvatarImageUrl(rawAvatar)
      : null;

    return {
      success: true,
      user: {
        id: userId,
        email: user.email,
        username: user.username,
        avatarUrl,
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Same email as an existing DynamoDB user (e.g. legacy email/password) but Cognito `sub` differs.
 * Move the row to use `sub` as partition key so Hosted UI / Google login works. Forum posts etc.
 * still reference the old userId until updated separately.
 */
async function migrateLegacyUserRowToCognitoSub(legacyRow, cognitoSub, usernameHint) {
  const email = legacyRow.email;
  const oldId = legacyRow.userId || legacyRow.id;
  let passwordField = legacyRow.passwordHash ?? legacyRow.password;
  if (!passwordField) {
    passwordField = await hashPassword(
      crypto.randomBytes(48).toString("hex"),
    );
  }
  const username =
    (usernameHint && String(usernameHint).slice(0, 120)) ||
    legacyRow.username ||
    email.split("@")[0];

  const newItem = {
    userId: cognitoSub,
    email,
    passwordHash: passwordField,
    username,
    createdAt:
      legacyRow.createdAt ?? Math.floor(Date.now() / 1000),
    status: legacyRow.status || "active",
  };
  if (legacyRow.avatarUrl != null) newItem.avatarUrl = legacyRow.avatarUrl;
  if (legacyRow.lastLogin != null) newItem.lastLogin = legacyRow.lastLogin;
  if (legacyRow.updatedAt != null) newItem.updatedAt = legacyRow.updatedAt;

  await db.migrateUserPartitionKey({
    oldUserId: oldId,
    email,
    newItem,
  });

  try {
    const n = await forumAdapter.rewriteAuthorUserId(oldId, cognitoSub);
    if (n > 0) {
      console.log(
        `[auth] Migrated forum authorUserId for ${n} post(s): ${oldId} → ${cognitoSub}`,
      );
    }
  } catch (e) {
    console.warn("[auth] rewriteAuthorUserId failed:", e.message);
  }
}

async function ensureDynamoUserFromCognito(userId, email, usernameHint) {
  if (!email) {
    throw new Error("Cannot create profile: missing email and Cognito sub");
  }
  const existing = await db.getUserById(userId);
  if (existing) return;

  const byEmail = await db.getUserByEmail(email);
  if (byEmail) {
    const otherId = byEmail.userId || byEmail.id;
    if (otherId && otherId !== userId) {
      const isSyntheticEmail = email.endsWith("@smartdive-federated.local");
      if (isSyntheticEmail) {
        throw new Error(
          "This email is already registered with a different sign-in account.",
        );
      }
      await migrateLegacyUserRowToCognitoSub(byEmail, userId, usernameHint);
      return;
    }
  }

  const hashedPassword = await hashPassword(
    crypto.randomBytes(48).toString("hex"),
  );
  const username =
    (usernameHint && String(usernameHint).slice(0, 120)) ||
    email.split("@")[0];

  await db.createUser({
    id: userId,
    email,
    password: hashedPassword,
    username,
    created_at: new Date().toISOString(),
  });
}

// Get user info (pass meta.email / meta.username when using Cognito so DynamoDB can sync profile)
const getUserInfo = async (userId, meta = {}) => {
  try {
    let user = await db.getUserById(userId);

    if (!user && isCognitoEnabled() && userId) {
      const trimmed = meta.email && String(meta.email).trim();
      const emailForEnsure =
        trimmed || `cognito-${userId}@smartdive-federated.local`;
      await ensureDynamoUserFromCognito(
        userId,
        emailForEnsure,
        meta.username,
      );
      user = await db.getUserById(userId);
    }

    if (!user) {
      throw new Error("User does not exist");
    }

    const rawAvatar = user.avatarUrl || null;
    const avatarUrl = rawAvatar
      ? await s3BannerSigning.signAvatarImageUrl(rawAvatar)
      : null;

    return {
      success: true,
      user: {
        id: user.id || user.userId,
        email: user.email,
        username: user.username,
        avatarUrl,
        created_at:
          user.created_at ||
          (user.createdAt
            ? new Date(user.createdAt * 1000).toISOString()
            : null),
        last_login:
          user.last_login ||
          (user.lastLogin
            ? new Date(user.lastLogin * 1000).toISOString()
            : null),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const setUserAvatar = async (req) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    if (!req.file?.buffer) {
      throw new Error("No file uploaded");
    }
    const user = await db.getUserById(userId, email);
    if (!user) {
      throw new Error("User does not exist");
    }
    const { avatarUrl } = await avatarService.persistAvatar(
      req.file.buffer,
      req.file.mimetype,
      userId,
      req,
    );
    await db.updateUser(userId, user.email, { avatarUrl });
    const signedUrl = await s3BannerSigning.signAvatarImageUrl(avatarUrl);
    return { success: true, avatarUrl: signedUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/** Stable email for DynamoDB when Cognito ID token omits `email` (fix Google / attribute mapping gaps). */
function cognitoEmailForProfile(payload) {
  const direct = payload.email && String(payload.email).trim();
  if (direct) return direct;
  const username = payload["cognito:username"];
  if (username && String(username).includes("@")) {
    return String(username).trim();
  }
  if (payload.sub) {
    return `cognito-${String(payload.sub)}@smartdive-federated.local`;
  }
  return "";
}

// Auth middleware for token verification (Cognito ID token or legacy JWT)
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Missing authentication token" });
  }

  if (isCognitoEnabled()) {
    try {
      const payload = await verifyCognitoIdToken(token);
      const email = cognitoEmailForProfile(payload);
      const displayEmail =
        (payload.email && String(payload.email).trim()) || email;
      req.user = {
        id: payload.sub,
        email,
        username:
          payload.name ||
          payload["cognito:username"] ||
          (displayEmail && displayEmail.includes("@")
            ? displayEmail.split("@")[0]
            : "Member"),
      };
      return next();
    } catch (err) {
      if (process.env.AUTH_DEBUG === "1") {
        console.warn("[auth] Cognito ID token verify failed:", err.message);
      }
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired token" });
    }
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }

  req.user = decoded;
  next();
};

async function verifyAnyToken(token) {
  if (isCognitoEnabled()) {
    return verifyCognitoIdToken(token);
  }
  const legacy = verifyToken(token);
  if (!legacy) {
    throw new Error("Invalid token");
  }
  return { sub: legacy.id, email: legacy.email };
}

/**
 * Legacy email/password users only (not used when Cognito verifies API tokens).
 * Sends a time-limited signed link; does not reveal whether the email is registered.
 */
async function requestPasswordReset(emailRaw) {
  const message =
    "If an account exists for that email, you will receive password reset instructions shortly.";
  try {
    const email = String(emailRaw || "").trim();
    if (!email) {
      return { success: true, message };
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return { success: true, message };
    }

    const userId = user.id || user.userId;
    const userEmail = user.email;
    if (!userId || !userEmail) {
      return { success: true, message };
    }

    const token = jwt.sign(
      { userId, email: userEmail, pwdReset: true },
      JWT_SECRET,
      { expiresIn: PASSWORD_RESET_JWT_EXPIRES },
    );

    const resetUrl = `${getPasswordResetFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await sendPasswordResetEmail(userEmail, resetUrl);
    } catch (mailErr) {
      console.error("[requestPasswordReset] send mail failed:", mailErr.message);
    }

    return { success: true, message };
  } catch (err) {
    console.error("[requestPasswordReset]", err);
    return { success: true, message };
  }
}

async function resetPasswordWithToken(tokenRaw, newPassword) {
  try {
    if (!tokenRaw || !newPassword) {
      throw new Error("Token and new password are required");
    }
    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    let payload;
    try {
      payload = jwt.verify(String(tokenRaw), JWT_SECRET);
    } catch {
      throw new Error(
        "Invalid or expired reset link. Please request a new password reset.",
      );
    }

    if (!payload.pwdReset || !payload.userId || !payload.email) {
      throw new Error("Invalid or expired reset link.");
    }

    const user = await db.getUserById(payload.userId);
    if (!user || user.email !== payload.email) {
      throw new Error("Invalid or expired reset link.");
    }

    const hashed = await hashPassword(newPassword);
    const uid = user.userId || user.id;
    await db.updateUser(uid, user.email, { password: hashed });

    return {
      success: true,
      message: "Your password has been updated. You can sign in now.",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateToken,
  verifyToken,
  verifyAnyToken,
  isCognitoEnabled,
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  getUserInfo,
  setUserAvatar,
  authMiddleware,
  requestPasswordReset,
  resetPasswordWithToken,
};
