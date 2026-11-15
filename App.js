// The backend server. Run it from the repo root:   node App.js   (or: npm start)
// It listens on port 4000, on this machine only. The web app (port 3000) passes
// the browser's /api requests on to it, and it is the only thing that talks to
// the AI service (port 8000).
//
//   /api/login, /api/logout, /api/me   sign-in                          (server/routes/auth.js)
//   /api/shares, /api/patients/...     share codes and the access log   (server/routes/shares.js)
//   /api/patients/:id/documents        timeline and upload              (server/routes/records.js, upload.js)
//   /api/notes, /api/reset             clinician notes, demo reset      (server/routes/records.js)
//   /api/chat, /api/estimate           companion and cost estimates     (server/routes/companion.js)
//   /api/device                        device type, for sizing the UI
//
// The data is in one SQLite file, data/app.db (server/db.js).
// Settings are in server/config.js. How the app is protected is in SECURITY.md.
const express = require("express");
const cors = require("cors");
const DeviceDetector = require("node-device-detector");
const DeviceHelper = require("node-device-detector/helper");
const ClientHints = require("node-device-detector/client-hints");

const config = require("./server/config");
const { securityHeaders, rateLimit, loadUser, requireAppHeader, REQUEST_HEADER } = require("./server/security");

const app = express();

app.disable("x-powered-by"); // do not advertise what the server is built with
app.set("trust proxy", config.trustProxy); // so req.ip is the visitor, not the web app in front of us

app.use(securityHeaders);

// Browsers block other websites from calling this API unless we say otherwise,
// and by default we do not. List sites in CORS_ORIGINS only if you host the web
// app on a different address from the API.
if (config.corsOrigins.length > 0) {
  app.use(cors({ origin: config.corsOrigins, credentials: true, allowedHeaders: ["content-type", REQUEST_HEADER] }));
}

// A ceiling for everything, per visitor. Costly routes have tighter limits of their own.
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.use(express.json({ limit: "100kb" })); // read JSON request bodies into req.body
app.use(loadUser); // sets req.user when the request carries a valid session cookie
app.use(requireAppHeader); // blocks requests forged from other websites

//Detect Device Type for Dimensions, UI
const detector = new DeviceDetector({
  clientIndexes: true,
  deviceIndexes: true,
  osIndexes: true,
  deviceAliasCode: false,
  deviceTrusted: false,
  deviceInfo: false,
});
const clientHints = new ClientHints();

app.get("/api/device", async (req, res) => {
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  const hints = clientHints.parse(req.headers, {}); // full headers object, not just the UA
  const result = await detector.detectAsync(userAgent, hints);

  res.json({
    result,
    deviceType: DeviceHelper.getDeviceType(result),
    isMobile: DeviceHelper.isMobile(result),
    isDesktop: DeviceHelper.isDesktop(result),
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", require("./server/routes/auth"));
app.use("/api", require("./server/routes/shares"));
app.use("/api", require("./server/routes/records"));
app.use("/api", require("./server/routes/upload"));
app.use("/api", require("./server/routes/companion"));

// Anything else: a plain "not found", in the same JSON shape as every other error.
app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Last stop for errors. The details go to the server log. The browser gets a
// short message with nothing about our code or data in it.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") return res.status(413).json({ error: "That request is too large." });
  if (error.type === "entity.parse.failed" || error.status === 400) return res.status(400).json({ error: "That request could not be read." });
  console.error(`${req.method} ${req.path} failed:`, error);
  res.status(500).json({ error: "Something went wrong on our side." });
});

// Start listening only when this file is run directly, so tests can load the app without opening a port.
if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`Backend on http://${config.host}:${config.port}${config.demoMode ? "  (demo mode: demo accounts and /api/reset are on)" : ""}`);
  });
}

module.exports = app;
