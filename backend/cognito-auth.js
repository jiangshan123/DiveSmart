/**
 * Verify Amazon Cognito ID tokens when COGNITO_USER_POOL_ID + COGNITO_CLIENT_ID are set.
 * App clients should use the same Client ID as the SPA (no client secret).
 */
const { CognitoJwtVerifier } = require("aws-jwt-verify");

function isCognitoEnabled() {
  return !!(
    process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID
  );
}

let verifier = null;

function getVerifier() {
  if (!isCognitoEnabled()) return null;
  if (!verifier) {
    const userPoolId = String(process.env.COGNITO_USER_POOL_ID || "").trim();
    const clientId = String(process.env.COGNITO_CLIENT_ID || "").trim();
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
      clientId,
    });
  }
  return verifier;
}

async function verifyCognitoIdToken(token) {
  const v = getVerifier();
  if (!v) {
    throw new Error("Cognito verifier not configured");
  }
  return v.verify(token);
}

module.exports = {
  isCognitoEnabled,
  verifyCognitoIdToken,
};
