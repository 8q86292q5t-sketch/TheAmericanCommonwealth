const crypto = require("node:crypto");

const COOKIE_NAME = "gc_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2));
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyPassword(password) {
  const [scheme, salt, expected] = (process.env.ADMIN_PASSWORD_HASH || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected || typeof password !== "string" || password.length > 256) return false;
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 64).toString("base64url");
  return safeEqual(actual, expected);
}

function signature(payload) {
  return crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "missing-secret").update(payload).digest("base64url");
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function isAuthenticated(request) {
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  const token = parseCookies(request.headers.cookie || "")[COOKIE_NAME];
  if (!token) return false;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature || !safeEqual(signature(payload), suppliedSignature)) return false;
  try {
    return Number(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_SECONDS}; SameSite=Strict${process.env.VERCEL ? "; Secure" : ""}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${process.env.VERCEL ? "; Secure" : ""}`;
}

function hasValidOrigin(request) {
  if (!request.headers.origin) return true;
  try {
    return new URL(request.headers.origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function requireAdmin(request, response) {
  if (!isAuthenticated(request)) {
    response.status(401).json({ error: "Administrator authentication required." });
    return false;
  }
  if (!hasValidOrigin(request)) {
    response.status(403).json({ error: "Request origin rejected." });
    return false;
  }
  return true;
}

module.exports = { clearSessionCookie, createSession, hasValidOrigin, isAuthenticated, requireAdmin, sessionCookie, verifyPassword };
