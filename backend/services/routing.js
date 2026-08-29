const { classifyExposure } = require('./normalizer');

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 30000;

const PROFILES = {
  driving: 'driving',
  cycling: 'cycling',
  walking: 'foot',
  'walking': 'foot',
};

// ---------------------------------------------------------------------------
// RoutingProvider abstraction.
// swapRoutingProvider() lets THERMA replace OSRM with another provider without
// touching the UI layer. Every provider returns the same normalized structure.
// ---------------------------------------------------------------------------

async function osrmProvider({ from, to, mode = 'driving', alternatives = true, steps = true }) {
  const profile = PROFILES[mode] || 'driving';
  const url = `${OSRM_URL}/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=${alternatives ? 'true' : 'false'}&steps=${steps}&overview=full&geometries=geojson&continue_straight=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'THERMA-routing/1.0' } });
  } catch (err) {
    clearTimeout(timer);
    const e = new Error('Routing service unreachable.');
    e.code = 'ROUTE_UNAVAILABLE';
    throw e;
  }
  clearTimeout(timer);
  if (!res.ok) {
    const e = new Error(`Routing service error (HTTP ${res.status}).`);
    e.code = 'ROUTE_UNAVAILABLE';
    throw e;
  }
  const body = await res.json();
  if (!body.routes || !body.routes.length) {
    const e = new Error('No route found between the selected points.');
    e.code = 'NO_ROUTE';
    throw e;
  }
  return body.routes.map((r, i) => ({
    id: `route-${i + 1}`,
    provider: 'osrm',
    mode,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    weight: r.weight,
    geometry: r.geometry || null,
    from, to,
  }));
}

class RoutingProvider {
  constructor(name = 'osrm') {
    this.name = name;
    this.provider = osrmProvider;
  }
  setProvider(fn) {
    this.provider = fn;
  }
  async getRoutes(params) {
    const routes = await this.provider(params);
    // A route may only reach the UI if its geometry is a plausible road route.
    // Fabricated/straight-line/water-crossing geometry must never render.
    const valid = [];
    for (const r of routes) {
      try {
        validateRouteGeometry(r, { from: params.from, to: params.to });
        valid.push(r);
      } catch (err) {
        console.error(`[ROUTING] rejected route ${r.id}: ${err.message}`);
      }
    }
    if (!valid.length) {
      const e = new Error('No routable road route found for this corridor.');
      e.code = 'ROUTE_INVALID';
      throw e;
    }
    return valid;
  }
}

// ---------------------------------------------------------------------------
// Geometry validation. OSRM (overview=full) returns dense polyline points
// along the road network — a genuine route never contains huge coordinate
// jumps, never misses endpoints, and never degenerates to a straight line.
// ---------------------------------------------------------------------------
const MAX_SEGMENT_KM = 5;      // overview=full points are metres apart
const MIN_POINTS = 5;          // anything shorter is not a real corridor path
const STRAIGHT_MAX_DEVIATION_M = 30;  // max allowed deviation from the great-circle

function validateRouteGeometry(route, { from, to } = {}) {
  const coords = route && route.geometry && route.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < MIN_POINTS) {
    throw new Error('geometry missing or too short');
  }
  let prev = null;
  let total = 0;
  let maxDev = 0;
  for (const c of coords) {
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new Error('invalid coordinate in geometry');
    }
    if (prev) {
      const d = haversineMeters(prev, [lon, lat]);
      if (d > MAX_SEGMENT_KM * 1000) {
        throw new Error(`impossible ${Math.round(d)}m jump between consecutive points`);
      }
      total += d;
    }
    prev = [lon, lat];
  }
  // A real road route meanders; a fabricated one hugs the straight line.
  const direct = haversineMeters([coords[0][0], coords[0][1]], [coords[coords.length - 1][0], coords[coords.length - 1][1]]);
  for (const c of coords) {
    const dEnds = haversineMeters([coords[0][0], coords[0][1]], c) + haversineMeters(c, [coords[coords.length - 1][0], coords[coords.length - 1][1]]);
    maxDev = Math.max(maxDev, dEnds - direct);
  }
  if (direct > 500 && maxDev < STRAIGHT_MAX_DEVIATION_M) {
    throw new Error('geometry is a straight line, not a road route');
  }
  // Endpoints must anchor to the requested origin/destination (OSRM snaps to
  // the nearest road — a couple of km of tolerance covers snapping).
  if (from) {
    const d = haversineMeters([from.lon, from.lat], coords[0]);
    if (d > 2500) throw new Error(`route start ${Math.round(d)}m from requested origin`);
  }
  if (to) {
    const d = haversineMeters([to.lon, to.lat], coords[coords.length - 1]);
    if (d > 2500) throw new Error(`route end ${Math.round(d)}m from requested destination`);
  }
  if (route.distanceMeters && Math.abs(route.distanceMeters - total) > Math.max(500, route.distanceMeters * 0.25)) {
    throw new Error('declared distance disagrees with geometry length');
  }
  return true;
}

const routing = new RoutingProvider();

function swapRoutingProvider(fn) {
  routing.setProvider(fn);
}

// ---------------------------------------------------------------------------
// Thermal association.
// ---------------------------------------------------------------------------

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pointInTile(lon, lat, tile) {
  const b = tile.bounds;
  if (!b) return false;
  return lon >= b[0][0] && lon <= b[1][0] && lat >= b[0][1] && lat <= b[1][1];
}

function sampleGeometry(coords, maxPoints = 160) {
  if (coords.length <= maxPoints) return coords;
  const out = [];
  const step = coords.length / maxPoints;
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[Math.floor(i)]);
  }
  if (out[out.length - 1] !== coords[coords.length - 1]) out.push(coords[coords.length - 1]);
  return out;
}

function associateThermal(route, heatmapTiles) {
  const tiles = (heatmapTiles || []).filter((t) => t.value != null && t.bounds);
  if (!tiles.length || !route.geometry) {
    return {
      exposure: null,
      segments: [],
      coverage: 0,
    };
  }
  const coords = sampleGeometry(route.geometry.coordinates);
  const samples = coords.map(([lon, lat]) => {
    let best = null;
    let bestDist = Infinity;
    for (const t of tiles) {
      if (pointInTile(lon, lat, t)) {
        best = t;
        break;
      }
      const d = haversineMeters([lon, lat], t.center);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return { lon, lat, tile: best, value: best ? best.value : null };
  });

  const values = samples.filter((s) => s.value != null).map((s) => s.value);
  const covered = values.length / samples.length;
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const peakIdx = values.length ? values.indexOf(max) : -1;

  // Segment the route into ~6 coarse segments and expose each one.
  const SEGMENTS = 6;
  const segLen = Math.floor(samples.length / SEGMENTS);
  const segments = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const slice = samples.slice(i * segLen, i === SEGMENTS - 1 ? samples.length : (i + 1) * segLen);
    const sv = slice.filter((s) => s.value != null).map((s) => s.value);
    const segAvg = sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : null;
    const center = slice[Math.floor(slice.length / 2)] || { lon: 0, lat: 0 };
    segments.push({
      index: i,
      start: slice[0] ? { lon: slice[0].lon, lat: slice[0].lat } : null,
      end: slice[slice.length - 1] ? { lon: slice[slice.length - 1].lon, lat: slice[slice.length - 1].lat } : null,
      center: { lon: center.lon, lat: center.lat },
      avgC: segAvg,
      avgF: segAvg != null ? (segAvg * 9) / 5 + 32 : null,
      exposure: segAvg != null ? classifyExposure(segAvg, { units: 'celsius' }) : null,
    });
  }

  const riskClasses = { Low: 0, Moderate: 1, Elevated: 2, High: 3, Critical: 4, Cool: 0, Mild: 1, Warm: 2, Hot: 3, Extreme: 4 };
  const peakExposure = segments
    .filter((s) => s.exposure)
    .sort((a, b) => (riskClasses[b.exposure.band] || 0) - (riskClasses[a.exposure.band] || 0))[0] || null;

  const exposureScore = mean != null ? Math.round(Math.min(100, Math.max(0, ((mean - 24) / 16) * 100))) : null;

  return {
    exposure: {
      source: 'therma-analysis',
      minC: min != null ? +min.toFixed(2) : null,
      maxC: max != null ? +max.toFixed(2) : null,
      meanC: mean != null ? +mean.toFixed(2) : null,
      minF: min != null ? +((min * 9) / 5 + 32).toFixed(1) : null,
      maxF: max != null ? +((max * 9) / 5 + 32).toFixed(1) : null,
      meanF: mean != null ? +((mean * 9) / 5 + 32).toFixed(1) : null,
      score: exposureScore,
      band: mean != null ? classifyExposure(mean, { units: 'celsius' }).band : null,
      peakSegment: peakExposure,
      sampledPoints: samples.length,
    },
    segments,
    coverage: +covered.toFixed(2),
  };
}

module.exports = {
  routing,
  osrmProvider,
  swapRoutingProvider,
  associateThermal,
  haversineMeters,
};