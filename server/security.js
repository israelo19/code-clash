// The backend's security helpers: response headers, rate limits, who is signed
// in, and who is allowed to do what. Routes use these instead of repeating checks.

const config = require("./config");
const db = require("./db");

// ---------- response headers

// The headers the OWASP REST and HTTP-headers cheat sheets recommend for an API
// that only returns JSON. Set by hand so we need no extra library.
function securityHeaders(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff", // do not guess the content type
    "X-Frame-Options": "DENY", // never show our responses inside a frame
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", // a JSON API loads nothing
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Cache-Control": "no-store", // health data must not sit in a browser or proxy cache
  });
  if (config.secureCookies) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

// ---------- rate limits

// Counts requests per key (an address, a user, an email) in a time window, in
// memory. Good for one server. Several servers would need a shared store.
const limiters = [];

function rateLimit({ windowMs, max, key = (req) => req.ip, message = "Too many requests. Wait a little and try again." }) {
  const hits = new Map(); // key -> { count, resetAt }
  limiters.push(hits);
  return function limit(req, res, next) {
    const id = key(req);
    if (id === undefined || id === null) return next();
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Forget finished windows once a minute so the maps cannot grow forever.
setInterval(() => {
  const now = Date.now();
  for (const hits of limiters) {
    for (const [id, entry] of hits) if (entry.resetAt <= now) hits.delete(id);
  }
}, 60_000).unref();

// For tests: start every counter from zero.
function resetRateLimits() {
  for (const hits of limiters) hits.clear();
}

// ---------- sessions (who is signed in)

// A plain name that says nothing about the app. Over HTTPS it gets the "__Host-"
// prefix, which makes the browser refuse the cookie unless it is Secure, covers
// the whole site and belongs to exactly this host (no other subdomain can set it).
const SESSION_COOKIE = config.secureCookies ? "__Host-id" : "id";

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

function cookieOptions() {
  return {
    httpOnly: true, // page scripts cannot read it, so a script injection cannot steal the session
    sameSite: "strict", // the browser will not send it on requests started by another site
    secure: config.secureCookies,
    path: "/",
  };
}

// Sign a user in: make a brand new session and hand the browser its cookie.
// Any session the browser already had is ended first, so an old cookie that
// someone else may have seen stops working.
function startSession(req, res, userId) {
  const previous = readCookie(req, SESSION_COOKIE);
  if (previous) db.deleteSession(previous);
  const { token, expiresAt } = db.createSession(userId, config.sessionHours);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: new Date(expiresAt) });
}

function endSession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.deleteSession(token);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Runs on every request: if the cookie belongs to a live session, req.user is
// that user ({ id, role, name }). Otherwise req.user stays empty.
function loadUser(req, res, next) {
  const token = readCookie(req, SESSION_COOKIE);
  req.user = token ? db.getSessionUser(token, config.sessionIdleMinutes) || null : null;
  next();
}

// ---------- permission checks

// The route needs someone signed in, optionally with one role.
function requireUser(role) {
  return function check(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Sign in first." });
    if (role && req.user.role !== role) return res.status(403).json({ error: "Your account cannot do that." });
    next();
  };
}

// For /patients/:id/... routes: only that patient may use them. Without this
// check anyone signed in could read someone else's records by changing the id.
function requireSelf(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in first." });
  if (req.user.role !== "patient" || req.user.id !== req.params.id) {
    return res.status(403).json({ error: "You can only open your own records." });
  }
  next();
}

// Requests that change something must carry this header. A form on another
// website cannot add a custom header, and a script on another website is
// stopped by the browser before it can send one. Together with the SameSite
// cookie this blocks cross-site request forgery.
const REQUEST_HEADER = "x-carevault-request";

function requireAppHeader(req, res, next) {
  const changes = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  // Modern browsers also say where a request started. "cross-site" means another website.
  const fromAnotherSite = req.get("sec-fetch-site") === "cross-site";
  if (changes && (!req.get(REQUEST_HEADER) || fromAnotherSite)) {
    return res.status(403).json({ error: "This request did not come from the app." });
  }
  next();
}

module.exports = {
  securityHeaders,
  rateLimit,
  resetRateLimits,
  startSession,
  endSession,
  loadUser,
  requireUser,
  requireSelf,
  requireAppHeader,
  SESSION_COOKIE,
  REQUEST_HEADER,
};
