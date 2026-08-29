const express = require('express');
const path = require('path');
const contextSvc = require('./backend/services/context');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));

// API routes first (never serve credentials under /public or /api).
app.use('/api', require('./backend/api'));

// Static frontend.
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// SPA fallback (hash router — server only needs index).
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ---- Error handling (never leak internals to the browser) ----------------
app.use((err, req, res, next) => {
  if (err && err.code === 'INVALID_LOCATION') {
    return res.status(400).json({ error: { code: 'INVALID_LOCATION', message: 'Location not found. Try another Florida location.' } });
  }
  if (err && err.name === 'FortyGuardError') {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 502;
    return res.status(status).json({
      error: { code: 'HEAT_UNAVAILABLE', message: 'Heat intelligence is temporarily unavailable.', detail: err.message },
    });
  }
  if (err && (err.code === 'ROUTE_UNAVAILABLE' || err.code === 'NO_ROUTE' || err.code === 'ROUTE_INVALID')) {
    const msg = err.code === 'NO_ROUTE'
      ? 'No route found between the selected points.'
      : err.code === 'ROUTE_INVALID'
        ? 'Route unavailable for this corridor — the road network returned no valid geometry. Choose another origin/destination.'
        : 'Routing service is temporarily unavailable.';
    return res.status(503).json({ error: { code: err.code, message: msg } });
  }
  console.error('[THERMA] unhandled error:', err && (err.stack || err.message));
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the THERMA backend. Please try again.' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`◉ THERMA backend running at http://localhost:${PORT}`);
  console.log(`  FortyGuard: ${contextSvc.isDemoRequest({}) ? 'demo-first configuration' : 'live-first configuration'}`);
});