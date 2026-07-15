const { clearSessionCookie, createSession, hasValidOrigin, isAuthenticated, sessionCookie, verifyPassword } = require("../_lib/auth");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET") return response.status(200).json({ authenticated: isAuthenticated(request) });
  if (!hasValidOrigin(request)) return response.status(403).json({ error: "Request origin rejected." });
  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", clearSessionCookie());
    return response.status(200).json({ authenticated: false });
  }
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  if (!process.env.ADMIN_PASSWORD_HASH || !process.env.ADMIN_SESSION_SECRET) return response.status(503).json({ error: "Administrator authentication is not configured." });
  if (!verifyPassword(request.body?.password)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return response.status(401).json({ error: "Incorrect password." });
  }
  response.setHeader("Set-Cookie", sessionCookie(createSession()));
  return response.status(200).json({ authenticated: true });
};
