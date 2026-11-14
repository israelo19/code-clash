// The backend server. Run it from the repo root:   node App.js   (or: npm start)
// It listens on port 4000. The web app is on 3000 and the AI service on 8000.
//
//   /api/device                      device type, for sizing the UI
//   /api/shares, /api/patients/...   share codes and the access log   (server/routes/shares.js)
//   /api/patients/:id/documents      timeline and upload              (server/routes/records.js, upload.js)
//   /api/notes, /api/reset           clinician notes, demo reset      (server/routes/records.js)
//
// The data is in one SQLite file, data/app.db (server/db.js).
const express = require("express");
const cors = require("cors");
const DeviceDetector = require("node-device-detector");
const DeviceHelper = require("node-device-detector/helper");
const ClientHints = require("node-device-detector/client-hints");

const app = express();

app.use(cors()); // the web app is served from another port, so the browser needs this to call us
app.use(express.json()); // read JSON request bodies into req.body

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
  const userAgent = req.headers["user-agent"] || "";
  const hints = clientHints.parse(req.headers, {}); // full headers object, not just the UA
  const result = await detector.detectAsync(userAgent, hints);

  console.log(result);

  res.json({
    result,
    deviceType: DeviceHelper.getDeviceType(result),
    isMobile: DeviceHelper.isMobile(result),
    isDesktop: DeviceHelper.isDesktop(result),
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", require("./server/routes/shares"));
app.use("/api", require("./server/routes/records"));
app.use("/api", require("./server/routes/upload"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend on http://localhost:${PORT}`));
