const fg = require('./fortyguard');
const geo = require('./geo');
const cache = require('./cache');
const { normalizeHeatmap, normalizeEnv, analyzeExposure, C_TO_F } = require('./normalizer');
const demoData = require('./demoData');
const { assets } = require('../data/assets');

const DEMO_DEFAULT = process.env.THERMA_DEMO !== '0';

function isDemoRequest(query) {
  if (query && typeof query.demo === 'string') {
    return query.demo === '1' || query.demo === 'true';
  }
  return DEMO_DEFAULT;
}

function nearestTileValue(tiles, lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const t of tiles) {
    const dx = (lon - t.center.lon) * Math.cos((lat * Math.PI) / 180);
    const dy = lat - t.center.lat;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best ? best.value : null;
}

function enrichAssets(tiles) {
  return assets.map((a) => {
    const value = nearestTileValue(tiles, a.lat, a.lon);
    const risk = value == null
      ? null
      : { band: value >= 34.5 ? 'Critical' : value >= 32.5 ? 'High' : value >= 31 ? 'Moderate' : value >= 29.5 ? 'Low' : 'Minimal', index: value >= 34.5 ? 5 : value >= 32.5 ? 4 : value >= 31 ? 3 : value >= 29.5 ? 2 : 1 };
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      category: a.category,
      lat: a.lat,
      lon: a.lon,
      tempC: value != null ? Math.round(value * 100) / 100 : null,
      tempF: value != null ? Math.round(C_TO_F(value) * 10) / 10 : null,
      risk,
    };
  });
}

function generateAlerts({ exposure, assets, environment, location }) {
  const alerts = [];
  const hotAssets = assets
    .filter((a) => a.risk && (a.risk.index >= 4))
    .sort((a, b) => (b.risk ? b.risk.index : 0) - (a.risk ? a.risk.index : 0));

  const now = new Date();
  if (exposure && exposure.score >= 75) {
    alerts.push({
      id: 'alt-extreme-heat',
      type: 'Extreme Heat',
      location: location.display,
      severity: 'Critical',
      time: now.toISOString(),
      description: `Sustained temperatures around ${Math.round((exposure.temperature || 0) * 9 / 5 + 32)}°F with elevated heat index across ${location.display}.`,
      impact: 'Outdoor operations at elevated risk; cooling demand rising across the district.',
      recommendation: 'Shift outdoor activity to early morning; dispatch cooling resources to priority zones.',
      status: 'active',
      category: 'heat',
    });
  }

  hotAssets.slice(0, 4).forEach((a, i) => {
    alerts.push({
      id: `alt-asset-${a.id}`,
      type: a.category === 'logistics' ? 'Logistics Exposure' : a.category === 'energy' ? 'Infrastructure Stress' : 'Exposure',
      location: a.name,
      severity: a.risk && a.risk.index >= 5 ? 'Critical' : 'High',
      time: new Date(now.getTime() - i * 7 * 60000).toISOString(),
      description: `${a.name} is exposed to peak-surface conditions (${a.tempF}°F estimated at ${location.display} heat layer).`,
      impact: a.category === 'healthcare' ? 'Sensitive populations and equipment exposed to sustained heat.' : a.category === 'energy' ? 'Thermal stress can reduce equipment life and load headroom.' : 'Operational performance may degrade during peak hours.',
      recommendation: 'Prioritize inspections during cooler hours; stage mitigation for next-day peak window.',
      status: i === 0 ? 'active' : 'active',
      category: a.category,
      assetId: a.id,
    });
  });

  if (environment && environment.current && environment.current.heatIndexC > 36) {
    alerts.push({
      id: 'alt-heat-index',
      type: 'Heat Index Advisory',
      location: location.display,
      severity: 'High',
      time: new Date(now.getTime() - 25 * 60000).toISOString(),
      description: `Heat index near ${Math.round(C_TO_F(environment.current.heatIndexC))}°F — compounding humidity elevates perceived heat.`,
      impact: 'Perceived heat exceeds air temperature thresholds; fatigue and health risk rise.',
      recommendation: 'Use apparent-temperature thresholds for outdoor staffing decisions.',
      status: 'active',
      category: 'environment',
    });
  }

  return alerts;
}

function generateRecommendations({ exposure, environment, alerts, location }) {
  const recs = [];
  if (exposure && exposure.score >= 60) {
    recs.push({
      id: 'rec-1',
      priority: 'High',
      title: 'Cool the priority corridor',
      detail: `Focus cooling interventions on ${location.display}'s highest-exposure zones first, where surface estimates sit ${Math.round((exposure.temperature || 0) * 9 / 5 + 32)}°F during peak.`,
      type: 'intervention',
    });
  }
  if (environment && environment.current && environment.current.humidity >= 60) {
    recs.push({
      id: 'rec-2',
      priority: 'Medium',
      title: 'Use heat-index thresholds',
      detail: 'Humidity is compounding perceived temperature. Base operational windows on apparent temperature rather than air temperature.',
      type: 'operations',
    });
  }
  if (alerts.some((a) => a.category === 'energy')) {
    recs.push({
      id: 'rec-3',
      priority: 'Medium',
      title: 'Stage grid-stress inspections',
      detail: 'Energy assets are near thermal-stress bands. Move maintenance to pre-dawn windows to extend asset life.',
      type: 'maintenance',
    });
  }
  if (exposure && exposure.score < 60) {
    recs.push({
      id: 'rec-4',
      priority: 'Standard',
      title: 'Maintain green cover',
      detail: 'Expand shade and vegetation coverage in known heat-island cells to flatten peak surface temperatures over time.',
      type: 'planning',
    });
  }
  return recs;
}

function demoAll(place, { layers = ['temperature', 'persistence', 'exceedance', 'time_of_measure'] } = {}) {
  const heatmap = demoData.demoHeatmap(place, { analyticType: 'temperature' });
  const layerMap = {};
  for (const l of layers) {
    if (l === 'temperature') continue;
    layerMap[l] = demoData.demoHeatmap(place, { analyticType: l });
  }
  const environment = demoData.demoEnv(place);
  const exposure = analyzeExposure({ heatmap, env: environment, locationLabel: place.display });
  const assetList = enrichAssets(heatmap.grid);
  const alerts = generateAlerts({ exposure, assets: assetList, environment, location: place });
  const recommendations = generateRecommendations({ exposure, environment, alerts, location: place });
  return {
    source: 'demo',
    demo: true,
    location: place,
    heatmap,
    layers: layerMap,
    environment,
    exposure,
    assets: assetList,
    alerts,
    recommendations,
  };
}

async function loadHeatmapLayer(place, layer, { demo } = {}) {
  // The mode is part of the key: a cached DEMO layer must never satisfy a
  // LIVE request (and vice versa) — mode switches must hit their own pipeline.
  const key = `heat:${demo ? 'demo' : 'live'}:${place.id}:${layer}:${new Date().toISOString().slice(0, 10)}`;
  if (demo) {
    return cache.memoized(
      () => Promise.resolve(demoData.demoHeatmap(place, { analyticType: layer })),
      key, 60 * 60 * 1000
    );
  }
  return cache.memoized(async () => {
    const polygon = geo.buildAoi(place, { maxSideKm: 9 });
    const raw = await fg.createHeatmap({
      polygon,
      analyticType: layer === 'temperature' ? 'tcm' : layer,
      filterType: 3,
      granularity: 100,
      threshold: 30,
      direction: 'above',
      options: { pollIntervalMs: 3000, timeoutMs: 240000 },
    });
    return normalizeHeatmap(raw.result, { source: 'fortyguard', location: place.display });
  }, key, 45 * 60 * 1000);
}

async function loadEnvironment(place, anchorTempC, { demo, refresh = false } = {}) {
  const key = `env:${demo ? 'demo' : 'live'}:${place.id}:${new Date().toISOString().slice(0, 10)}`;
  if (demo) {
    const make = () => Promise.resolve(demoData.demoEnv(place));
    if (refresh) return make();
    return cache.memoized(make, key, 60 * 60 * 1000);
  }
  const fetchLive = async () => {
    const raw = await fg.environmentalParameters({
      latitude: place.lat,
      longitude: place.lon,
      temperature: Math.round((anchorTempC || 30) * 100) / 100 || 30,
      filterType: 3,
      analysis: [
        'heat_index_celsius', 'apparent_temperature_celsius', 'wet_bulb_temperature_celsius',
        'relative_humidity_percent', 'precipitation_mm', 'cloud_cover_octas', 'air_quality:idx',
        'co2_ppm', 'solar_irradiance', 'methane_ppb',
      ],
      options: { pollIntervalMs: 3000, timeoutMs: 180000 },
    });
    return normalizeEnv(raw.result, { source: 'fortyguard', location: place.display });
  };
  if (refresh) return fetchLive();
  return cache.memoized(fetchLive, key, 60 * 60 * 1000);
}

async function loadContext({ place, layers = ['temperature', 'persistence', 'exceedance', 'time_of_measure'], demo }) {
  if (demo) return demoAll(place, { layers });

  const heatmap = await loadHeatmapLayer(place, 'temperature', { demo: false });
  const env = await loadEnvironment(place, heatmap.stats.mean, { demo: false });
  const layerMap = { heatmap };
  for (const l of layers) {
    if (l === 'temperature') continue;
    try {
      layerMap[l] = await loadHeatmapLayer(place, l, { demo: false });
    } catch (err) {
      layerMap[l] = { error: true, source: 'fortyguard', kind: l, message: err.message };
    }
  }
  const exposure = analyzeExposure({ heatmap, env, locationLabel: place.display });
  const assetList = enrichAssets(heatmap.grid);
  const alerts = generateAlerts({ exposure, assets: assetList, environment: env, location: place });
  const recommendations = generateRecommendations({ exposure, environment: env, alerts, location: place });
  return {
    source: 'live',
    demo: false,
    location: place,
    heatmap,
    layers: layerMap,
    environment: env,
    exposure,
    assets: assetList,
    alerts,
    recommendations,
  };
}

async function focusContext(placeIdOrPoint, { demo } = {}) {
  let p = null;
  if (typeof placeIdOrPoint === 'string') {
    p = geo.placeById(placeIdOrPoint);
    if (!p) {
      // Support "lat,lon" coordinate deep links (e.g. #location/25.77,-80.19).
      const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,+ ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(placeIdOrPoint);
      if (m) {
        const lat = parseFloat(m[1]);
        const lon = parseFloat(m[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          p = {
            id: `${lat},${lon}`,
            lat,
            lon,
            name: 'Coordinates',
            display: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            type: 'coordinates',
            region: 'Florida',
            county: 'Custom point',
          };
        }
      }
    }
  } else if (placeIdOrPoint && placeIdOrPoint.lat != null) {
    p = placeIdOrPoint;
  }
  if (!p) {
    const err = new Error('Unknown location.');
    err.code = 'INVALID_LOCATION';
    throw err;
  }
  return p;
}

module.exports = { loadContext, loadHeatmapLayer, loadEnvironment, loadContextDemo: demoAll, isDemoRequest, focusContext, DEMO_DEFAULT, generateAlerts, generateRecommendations };