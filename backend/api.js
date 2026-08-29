const express = require('express');
const geo = require('./services/geo');
const fg = require('./services/fortyguard');
const contextSvc = require('./services/context');
const cache = require('./services/cache');
const { routing, associateThermal } = require('./services/routing');
const { normalizeHeatmap, normalizeEnv, normalizeSatellite, normalizeStreetView, C_TO_F } = require('./services/normalizer');
const zoe = require('./services/zoe');
const reports = require('./services/reports');
const { credentials } = require('./config');

const router = express.Router();

const AOI_MAX_KM = 9;

function cappedAoi(p) {
  let bbox = p.bbox;
  if (bbox) {
    const sideKmLat = (bbox[1][1] - bbox[0][1]) * 111.32;
    const sideKmLon = (bbox[1][0] - bbox[0][0]) * 111.32 * Math.cos((p.lat * Math.PI) / 180);
    if (sideKmLat > AOI_MAX_KM || sideKmLon > AOI_MAX_KM) bbox = null;
  }
  return geo.buildAoi(p, { paddingKm: 1 });
}

function parsePoint(str) {
  const m = String(str || '').split(',').map((x) => parseFloat(x.trim()));
  if (m.length === 2 && !isNaN(m[0]) && !isNaN(m[1]) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) {
    return { lat: m[0], lon: m[1] };
  }
  return null;
}

// ----------------------------- health ------------------------------------

router.get('/health', (req, res, next) => {
  try {
    res.json({
      ok: true,
      name: 'THERMA Backend',
      time: new Date().toISOString(),
      services: {
        fortyguard: { available: credentials.fortyguardAvailable },
        gemini: { available: credentials.geminiAvailable },
        routing: { provider: routing.name },
      },
      demoDefault: contextSvc.DEMO_DEFAULT,
    });
  } catch (err) { next(err); }
});

router.get('/status/fortyguard', async (req, res, next) => {
  try {
    if (!credentials.fortyguardAvailable) {
      return res.json({ available: false });
    }
    const usage = await cache.memoized(async () => {
      const body = await fg.fetchUsage();
      return {
        available: true,
        plan: body.plan_details && body.plan_details.plan_type,
        subscriptionActive: body.api_key_details && body.api_key_details.status === 'active',
        remainingCredits: body.credit_summary && body.credit_summary.total_remaining_credits,
        usedCredits: body.credit_summary && body.credit_summary.cycle_credits_used,
        creditsReset: body.plan_details && body.plan_details.credits_reset_date,
      };
    }, 'fg:usage', 10 * 60 * 1000);
    res.json(usage);
  } catch (err) { next(err); }
});

// ----------------------------- geocoding ---------------------------------

router.get('/geo/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const results = await geo.searchPlaces(q);
    res.json({ results });
  } catch (err) { next(err); }
});

router.get('/geo/places', (req, res) => {
  res.json({ results: geo.places });
});

router.get('/geo/reverse', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: { code: 'INVALID_COORDS', message: 'Invalid coordinates.' } });
    const label = await geo.reverseGeocode(lat, lon);
    res.json({ label });
  } catch (err) { next(err); }
});

// ----------------------------- context -----------------------------------

router.get('/context', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    const ctx = await contextSvc.loadContext({ place, demo });
    // Strip heavy geometry from the context payload; the grid endpoint serves it.
    const slim = JSON.parse(JSON.stringify(ctx));
    slim.gridGeometry = null;
    for (const key of Object.keys(ctx.layers || {})) {
      if (ctx.layers[key] && ctx.layers[key].grid) {
        slim.layers[key] = { ...ctx.layers[key], grid: ctx.layers[key].grid.map((t) => ({ id: t.id, center: t.center, value: t.value, min: t.min, max: t.max, f: t.f, layer: t.layer, units: ctx.layers[key].units })) };
      }
    }
    if (slim.heatmap && slim.heatmap.grid) {
      slim.heatmap = { ...slim.heatmap, grid: slim.heatmap.grid.map((t) => ({ id: t.id, center: t.center, value: t.value, min: t.min, max: t.max, f: t.f, layer: t.layer })) };
    }
    res.json(slim);
  } catch (err) { next(err); }
});

router.get('/context/grid', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    const layer = String(req.query.layer || 'temperature');
    const heat = await contextSvc.loadHeatmapLayer(place, layer, { demo });
    if (heat.error) throw heat;
    res.json({ place, layer, fullGeometry: true, units: heat.units, stats: heat.stats, grid: heat.grid, fetchedAt: heat.fetchedAt, source: heat.source });
  } catch (err) { next(err); }
});

router.get('/context/layer', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    const layer = String(req.query.layer || 'persistence');
    const heat = await contextSvc.loadHeatmapLayer(place, layer, { demo });
    if (heat.error) {
      return res.status(503).json({ error: { code: 'LAYER_UNAVAILABLE', message: `${layer} layer is not available for this area.`, detail: heat.message } });
    }
    res.json({ place: place.display, source: heat.source, layer: heat.kind, units: heat.units, stats: heat.stats, fetchedAt: heat.fetchedAt, grid: heat.grid.map((t) => ({ id: t.id, center: t.center, value: t.value, layer: t.layer })) });
  } catch (err) { next(err); }
});

// ----------------------------- environment -------------------------------

router.get('/environment', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    const anchor = parseFloat(req.query.temperature);
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const env = await contextSvc.loadEnvironment(place, isNaN(anchor) ? 30 : anchor, { demo, refresh });
    res.json(env);
  } catch (err) { next(err); }
});

// ----------------------------- premium endpoints -------------------------

router.get('/satellite', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    if (demo || !credentials.fortyguardAvailable) {
      return res.status(403).json({ error: { code: 'PREMIUM_UNAVAILABLE', message: 'Satellite segmentation requires the FortyGuard Premium tier. Only show this tile when available on your plan.' } });
    }
    const raw = await fg.satelliteSegmentation({ latitude: place.lat, longitude: place.lon, startDate: fg.todayStr(-60), filterType: 3, granularity: 100 });
    res.json(normalizeSatellite(raw.result, { source: 'fortyguard', location: place.display }));
  } catch (err) { next(err); }
});

router.get('/streetview', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext(req.query.place || 'miami-downtown');
    const demo = contextSvc.isDemoRequest(req.query);
    if (demo || !credentials.fortyguardAvailable) {
      return res.status(403).json({ error: { code: 'PREMIUM_UNAVAILABLE', message: 'Street View segmentation requires the FortyGuard Premium tier.' } });
    }
    const raw = await fg.streetViewSegmentation({ latitude: place.lat, longitude: place.lon });
    res.json(normalizeStreetView(raw.result, { source: 'fortyguard', location: place.display }));
  } catch (err) { next(err); }
});

router.post('/heat-intelligence', async (req, res, next) => {
  try {
    const place = await contextSvc.focusContext((req.body && req.body.place) || 'miami-downtown');
    if (!credentials.fortyguardAvailable) {
      return res.status(403).json({ error: { code: 'PREMIUM_UNAVAILABLE', message: 'Heat Intelligence reports require FortyGuard Premium.' } });
    }
    const anchor = parseFloat(req.body && req.body.temperature) || 30;
    const result = await fg.heatIntelligence({ latitude: place.lat, longitude: place.lon, temperature: anchor, analysis: ['environmental', 'geographic', 'urban'] });
    res.json(result);
  } catch (err) { next(err); }
});

// ----------------------------- routes -------------------------------------

router.get('/routes', async (req, res, next) => {
  try {
    const mode = String(req.query.mode || 'driving');
    const demo = contextSvc.isDemoRequest(req.query);

    let from = parsePoint(req.query.from);
    let to = parsePoint(req.query.to);
    if (!from && req.query.fromId) {
      const p = geo.placeById(String(req.query.fromId));
      if (p) from = { lat: p.lat, lon: p.lon, name: p.display };
    }
    if (!to && req.query.toId) {
      const p = geo.placeById(String(req.query.toId));
      if (p) to = { lat: p.lat, lon: p.lon, name: p.display };
    }
    if (!from || !to) {
      return res.status(400).json({ error: { code: 'INVALID_ROUTE_POINTS', message: 'Provide valid origin and destination coordinates.' } });
    }

    // Choose the nearest curated place to the corridor for thermal association.
    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;
    let assoc = null;
    let assocPlace = null;
    let best = Infinity;
    for (const p of geo.places) {
      const d = Math.hypot(p.lat - midLat, (p.lon - midLon) * Math.cos((midLat * Math.PI) / 180));
      if (d < best) { best = d; assoc = p; }
    }
    if (best < 0.5 && assoc) assocPlace = assoc;

    const getRoutes = async () => {
      if (demo) {
        const dm = require('./services/demoData');
        const fromP = geo.placeById(req.query.fromId) || { id: 'from', lat: from.lat, lon: from.lon, display: 'Origin' };
        const toP = geo.placeById(req.query.toId) || { id: 'to', lat: to.lat, lon: to.lon, display: 'Destination' };
        return dm.demoRoutes(fromP, toP);
      }
      return routing.getRoutes({ from, to, mode, alternatives: true });
    };

    const routes = await getRoutes();

    // Thermal association from the nearby place heat layer.
    let tiles = [];
    if (demo) {
      const place = assocPlace || (geo.placeById(req.query.fromId) || geo.places[0]);
      const h = require('./services/demoData').demoHeatmap(place, { analyticType: 'temperature' });
      tiles = h.grid;
    } else {
      try {
        const place = assocPlace || geo.placeById(req.query.fromId) || geo.places[0];
        const heat = await contextSvc.loadHeatmapLayer(place, 'temperature', { demo: false });
        tiles = heat.grid;
      } catch (err) {
        console.error('[ROUTES] thermal association unavailable:', err.message);
        tiles = [];
      }
    }

    const enriched = routes.map((r) => {
      const thermal = associateThermal(r, tiles);
      const friendly = {
        'demo-route-fast': 'Fastest',
        'demo-route-balanced': 'Balanced',
        'demo-route-cool': 'Coolest',
        'route-1': 'Balanced',
        'route-2': 'Fastest',
        'route-3': 'Coolest',
      };
      const label = friendly[r.id] || r.label || r.id;
      return { ...r, label, demoEvaluated: demo, ...thermal };
    });

    res.json({
      from: { lat: from.lat, lon: from.lon, name: from.name || from.lat.toFixed(4) + ', ' + from.lon.toFixed(4) },
      to: { lat: to.lat, lon: to.lon, name: to.name || to.lat.toFixed(4) + ', ' + to.lon.toFixed(4) },
      mode,
      demoEvaluation: demo,
      associationPlace: assocPlace ? assocPlace.display : null,
      routes: enriched,
    });
  } catch (err) { next(err); }
});

// ----------------------------- zoe ----------------------------------------

router.post('/zoe', async (req, res, next) => {
  try {
    const message = String((req.body && req.body.message) || '').slice(0, 2000);
    if (!message) {
      return res.status(400).json({ error: { code: 'EMPTY_MESSAGE', message: 'Send a message to Zoe.' } });
    }
    const result = await zoe.answer({
      message,
      context: (req.body && req.body.context) || {},
      history: Array.isArray(req.body && req.body.history) ? req.body.history.slice(-8) : [],
    });
    res.json(result);
  } catch (err) { next(err); }
});
// ----------------------------- reports ------------------------------------

// Report-generation diagnostics. In development a failed build answers with the
// stage it died in and the exception message, so the browser shows something
// actionable instead of the generic 500. In production this is off and the
// request falls through to the shared handler's opaque INTERNAL envelope.
// Never includes a stack trace, the request context, or any credential material.
const REPORT_DIAGNOSTICS = process.env.NODE_ENV !== 'production' && process.env.THERMA_REPORT_DEBUG !== '0';

router.post('/reports/generate', (req, res, next) => {
  const requestId = `REPORT_DEBUG_${Date.now()}${String(Math.random()).slice(2, 8)}`;
  let stage = 'REQUEST_START';
  const fail = (status, code, message, next_) => {
    console.log(`[REPORT] FAILED  stage=${stage}  id=${requestId}  code=${code}  message=${message}`);
    if (!REPORT_DIAGNOSTICS && status >= 500) return next_();
    return res.status(status).json({ ok: false, error: { code, message, stage, requestId } });
  };
  try {
    const ctx = (req.body && req.body.context) || null;
    console.log(`[REPORT] REQUEST_START  id=${requestId} bodyKeys=${Object.keys(req.body || {}).join(',')}`);

    stage = 'REQUEST_BODY_RECEIVED';
    console.log(`[REPORT] REQUEST_BODY_RECEIVED  id=${requestId}`);

    stage = 'CONTEXT_VALIDATED';
    if (!ctx || !ctx.location) {
      return fail(400, 'MISSING_CONTEXT', 'A current application context is required to generate a report.', next);
    }
    if (!ctx.location.display) {
      return fail(400, 'INVALID_CONTEXT', 'Report context is missing required location.display property.', next);
    }
    console.log(`[REPORT] CONTEXT_VALIDATED  id=${requestId} PASS: ctx.location=${ctx.location.display}`);

    stage = 'HTML_BUILD_START';
    const report = reports.buildReport(ctx);
    stage = 'HTML_BUILD_COMPLETE';
    console.log(`[REPORT] HTML_BUILD_COMPLETE  id=${requestId} reportId=${report.id} htmlLength=${report.html.length}`);

    stage = 'ARTIFACT_STORED';
    console.log(`[REPORT] ARTIFACT_STORED  id=${requestId} reportId=${report.id}`);

    stage = 'RESPONSE_SENT';
    res.json({ id: report.id, meta: report.meta, html: report.html });
    console.log(`[REPORT] RESPONSE_SENT  id=${requestId} reportId=${report.id}`);
  } catch (err) {
    // Prefer the builder's own last-entered stage — it is finer-grained than
    // anything this handler can see from the outside.
    const builderStage = typeof reports.lastStage === 'function' ? reports.lastStage() : null;
    if (stage === 'HTML_BUILD_START' && builderStage) stage = builderStage;
    console.error(
      `[REPORT] FAILED  stage=${stage}  id=${requestId}` +
      `  error.name=${err && err.name}  error.message=${err && err.message}\nstack=${err && err.stack}`,
    );
    if (!REPORT_DIAGNOSTICS) return next(err);
    return res.status(500).json({
      ok: false,
      error: {
        code: (err && err.code) || 'REPORT_BUILD_FAILED',
        message: String((err && err.message) || 'Report generation failed.'),
        stage,
        requestId,
      },
    });
  }
});

router.get('/reports/:id', (req, res, next) => {
  try {
    const report = reports.getReport(String(req.params.id));
    if (!report) {
      // Reports live in server memory. For browser navigation (new tab), serve
      // a self-explaining page instead of raw JSON; API clients still get JSON.
      const wantsHtml = String(req.headers.accept || '').includes('text/html');
      if (wantsHtml) {
        return res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Report expired - THERMA</title>
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#0b0b0b;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:420px;background:#161616;border:1px solid #303030;border-radius:16px;padding:32px;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{font-size:13px;color:#a3a3a3;line-height:1.6;margin:0 0 16px}
a{color:#f5f5f5;font-weight:60}</style></head><body><div class="card">
<h1>Report no longer available</h1>
<p>Report <b>${String(req.params.id).replace(/[<>&]/g, '')}</b> was generated in a previous server session. THERMA stores reports in memory, so they expire when the backend restarts.</p>
<p>Regenerate it from the Reports Library in the application.</p>
<p><a href="/">Back to THERMA</a></p></div></body></html>`);
      }
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found. It may have expired with the server session - regenerate it from the Reports Library.' } });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(report.html);
  } catch (err) { next(err); }
});

module.exports = router;
