const express = require("express");
const path = require("path");
const contextSvc = require("./backend/services/context");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "6mb" }));

// API routes first
app.use("/api", require("./backend/api"));

// Static frontend - NEW UI (ui/dist)
const NEW_UI_DIR = path.join(__dirname, "ui", "dist");
app.use(express.static(NEW_UI_DIR, { index: "index.html" }));

// Also serve old public for reference
const PUBLIC_DIR = path.join(__dirname, "public");
app.use("/legacy", express.static(PUBLIC_DIR, { index: "index.html" }));

app.get("/", (req, res) => res.sendFile(path.join(NEW_UI_DIR, "index.html")));

// SPA fallback (hash router)
app.get(/^\/(?!api\/|legacy\/).*/, (req, res) => res.sendFile(path.join(NEW_UI_DIR, "index.html")));

// Error handling
app.use((err, req, res, next) => {
  if (err && err.code === "INVALID_LOCATION") {
    return res.status(400).json({ error: { code: "INVALID_LOCATION", message: "Location not found. Try another Florida location." } });
  }
  if (err && err.name === "FortyGuardError") {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 502;
    return res.status(status).json({
      error: { code: "HEAT_UNAVAILABLE", message: "Heat intelligence is temporarily unavailable.", detail: err.message }
    });
  }
  if (err && (err.code === "ROUTE_UNAVAILABLE" || err.code === "NO_ROUTE")) {
    return res.status(503).json({ error: { code: err.code, message: err.code === "NO_ROUTE" ? "No route found between the selected points." : "Routing service is temporarily unavailable." } });
  }
  console.error("[THERMA] unhandled error:", err && (err.stack || err.message));
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on the THERMA backend. Please try again." } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\u25c9 THERMA backend running at http://localhost:${PORT}`);
  console.log(`  FortyGuard: ${contextSvc.isDemoRequest({}) ? "demo-first configuration" : "live-first configuration"}`);
  console.log(`  New UI: http://localhost:${PORT}/`);
  console.log(`  Legacy UI: http://localhost:${PORT}/legacy/`);
});
