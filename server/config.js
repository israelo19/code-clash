// Settings for the backend, read from environment variables in one place.
// Every setting has a safe default, so the app runs locally with no setup.

const production = process.env.NODE_ENV === "production";

// "1" turns a yes/no setting on, "0" turns it off, anything else uses the default.
function flag(name, fallback) {
  if (process.env[name] === "1") return true;
  if (process.env[name] === "0") return false;
  return fallback;
}

module.exports = {
  production,

  // Demo mode seeds two demo accounts whose password is public (it is in this
  // repo), a share code that never expires, and allows POST /api/reset.
  // It is on for local use and OFF in production unless DEMO_MODE=1 is set.
  demoMode: flag("DEMO_MODE", !production),

  // Where the server listens. 127.0.0.1 means "this machine only": the browser
  // reaches the backend through the web app, which runs on the same machine.
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT) || 4000,

  // The AI service, and the shared secret we send it (see ai/main.py).
  aiUrl: process.env.AI_URL || "http://127.0.0.1:8000",
  aiToken: (process.env.AI_SERVICE_TOKEN || "").trim(),

  // Send the session cookie over HTTPS only. On in production.
  secureCookies: flag("COOKIE_SECURE", production),

  // How long a sign-in lasts at most, and how long it survives with no activity.
  // (The OWASP session cheat sheet suggests 4 to 8 hours and 15 to 30 minutes.)
  sessionHours: Number(process.env.SESSION_HOURS) || 8,
  sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES) || 30,

  // Which proxies may tell us the visitor's real address (X-Forwarded-For).
  // "loopback" trusts only a proxy on this machine, which is what the web app is.
  trustProxy: process.env.TRUST_PROXY || "loopback",

  // Other websites allowed to call this API from a browser, comma-separated.
  // Empty (the default) means none: the web app calls us through its own address.
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),

  maxUploadBytes: 15 * 1024 * 1024, // 15 MB, plenty for a phone photo or a PDF
};
