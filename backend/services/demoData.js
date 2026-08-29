// Deterministic, structured DEMO dataset generation.
// Produced ONLY when demo mode is enabled. Output carries `source: "therma-demo"`
// and the UI always labels it THERMA DEMO DATA — never passes it off as live
// FortyGuard measurements.

// Reuse the live path's band classifier so demo tiles carry the SAME
// { band, color, index } layer object normalizeHeatmap produces — the map renderer
// and tile inspectors (heat.js, explorer.js, overview.js) read t.layer.band/.color
// directly. normalizer.js requires nothing, so this introduces no dependency cycle.
const { classifyExposure } = require('./normalizer');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fractToChar(frac) {
  if (frac < 0.15) return 'U'; // water / undeveloped
  if (frac < 0.35) return 'P'; // park / trees
  if (frac < 0.6) return 'R'; // residential
  if (frac < 0.85) return 'C'; // commercial / dense streets
  return 'I'; // industrial/asphalt
}

function demoHeatmap(place, { analyticType = 'temperature', baseMean = 33.5, spread = 5.5 } = {}) {
  const rnd = mulberry32(hashSeed(`${place.id}:${baseMean}`));
  const isAnalysis = analyticType !== 'temperature';
  const units = isAnalysis ? 'hour' : 'celsius';

  let minLon, minLat, maxLon, maxLat;
  if (place.bbox) {
    [[minLon, minLat], [maxLon, maxLat]] = place.bbox;
  } else {
    minLon = place.lon - 0.03; maxLon = place.lon + 0.03;
    minLat = place.lat - 0.03; maxLat = place.lat + 0.03;
  }

  const latTiles = 14;
  const lonTiles = Math.max(10, Math.round((maxLon - minLon) / (maxLat - minLat) * latTiles));
  const tiles = [];
  const cx = (minLon + maxLon) / 2;
  const cy = (minLat + maxLat) / 2;
  const halfLat = (maxLat - minLat) / 2;
  const halfLon = (maxLon - minLon) / 2;

  for (let i = 0; i < lonTiles; i++) {
    for (let j = 0; j < latTiles; j++) {
      const lon0 = minLon + (i / lonTiles) * (maxLon - minLon);
      const lon1 = minLon + ((i + 1) / lonTiles) * (maxLon - minLon);
      const lat0 = minLat + (j / latTiles) * (maxLat - minLat);
      const lat1 = minLat + ((j + 1) / latTiles) * (maxLat - minLat);
      const lon = (lon0 + lon1) / 2;
      const lat = (lat0 + lat1) / 2;

      // Urban heat island: gaussian bump toward center + land-use offset + noise.
      const gx = (lon - cx) / halfLon;
      const gy = (lat - cy) / halfLat;
      const urban = Math.exp(-(gx * gx + gy * gy) * 1.2);
      const landUse = { U: -4.5, P: -2.2, R: 0, C: 2.8, I: 4.2 }[fractToChar(rnd())];

      let value = baseMean + urban * spread * 0.55 + landUse * 0.6 + (rnd() - 0.5) * 1.2;
      value = Math.max(23, Math.min(42, value));

      const avg = Math.round(value * 100) / 100;
      const tilesMin = Math.round((value - 0.4) * 100) / 100;
      const tilesMax = Math.round((value + 0.5) * 100) / 100;

      // Analysis-layer values synthesized from the same thermal field.
      let layerValue;
      if (analyticType === 'persistence') {
        layerValue = Math.round(Math.max(0.5, Math.min(14, (value - 27.5) * 1.8 + (rnd() * 2))) * 100) / 100;
      } else if (analyticType === 'exceedance') {
        layerValue = Math.round(Math.max(0, Math.min(10, (value - 30) * 2.4 + (rnd() * 1.2))) * 100) / 100;
      } else if (analyticType === 'time_of_measure') {
        layerValue = Math.round(11 + (value - baseMean) * 0.8 + rnd() * 3); // hour of day ~ 11-18 UTC peak
      } else {
        layerValue = avg;
      }

      const cellValue = Math.round(layerValue * 100) / 100;
      tiles.push({
        id: i * latTiles + j,
        center: { lon: Math.round(lon * 1e5) / 1e5, lat: Math.round(lat * 1e5) / 1e5 },
        bounds: [[lon0, lat0], [lon1, lat1]],
        value: cellValue,
        min: isAnalysis ? null : tilesMin,
        max: isAnalysis ? null : tilesMax,
        c: isAnalysis ? null : avg,
        f: isAnalysis ? null : Math.round((avg * 9) / 5 + 32),
        // Same band classification the live normalizer applies (see normalizer.js:100).
        layer: classifyExposure(cellValue, { units }),
      });
    }
  }

  const values = tiles.map((t) => t.value);
  const stats = {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    std: Math.sqrt(values.reduce((a, b) => a + (b - values.reduce((c, d) => c + d, 0) / values.length) ** 2, 0) / values.length) || 0,
    n: values.length,
  };

  // Temperature histogram for the DEMO layer, computed from the demo grid the
  // same way the live normalizer derives frequency from FortyGuard stats — a
  // derived property of the (labelled) demo data, not an invented payload.
  const frequency = (() => {
    if (isAnalysis) return null;
    const vals = values.filter((v) => Number.isFinite(v));
    if (!vals.length) return null;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const bins = 10;
    const step = (hi - lo) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of vals) {
      const idx = Math.min(bins - 1, Math.floor((v - lo) / step));
      counts[idx] += 1;
    }
    const axis = counts.map((_, i) => Math.round((lo + i * step) * 100) / 100);
    return { axis, counts };
  })();

  return {
    source: 'therma-demo',
    kind: analyticType,
    layer: analyticType,
    units,
    location: place.display || place.name,
    activityId: `demo-${place.id}-${analyticType}`,
    fetchedAt: new Date().toISOString(),
    stats: { min: stats.min, max: stats.max, mean: stats.mean, std: stats.std, n: stats.n },
    distribution: isAnalysis ? null : { overall: null, frequency },
    grid: tiles,
  };
}

function demoEnv(place, { baseMean = 33 } = {}) {
  const rnd = mulberry32(hashSeed(place.id + ':env'));
  const humidityBase = 62 + rnd() * 18;
  const hourly = [];
  const hourSeries = {
    heatIndex: [], apparentTemp: [], wetBulb: [], humidity: [], temperature: [],
  };
  for (let h = 0; h < 24; h++) {
    const diurnal = Math.sin(((h - 9) / 24) * Math.PI * 2) * 4.5;
    const temp = Math.max(24, Math.min(38, baseMean + diurnal));
    const humidity = Math.max(45, Math.min(95, humidityBase - diurnal * 4));
    const wetBulb = temp * 0.75 + humidity * 0.05;
    const heatIndex = temp + (humidity >= 60 ? (humidity - 60) * 0.18 : 0);
    hourSeries.temperature.push(Math.round(temp * 100) / 100);
    hourSeries.humidity.push(Math.round(humidity * 100) / 100);
    hourSeries.wetBulb.push(Math.round(wetBulb * 100) / 100);
    hourSeries.heatIndex.push(Math.round(heatIndex * 100) / 100);
    hourSeries.apparentTemp.push(Math.round((temp + heatIndex) / 2 * 100) / 100);
  }

  const peakIdx = hourSeries.temperature.indexOf(Math.max(...hourSeries.temperature));
  return {
    source: 'therma-demo',
    kind: 'environment',
    units: 'mixed',
    location: place.display || place.name,
    fetchedAt: new Date().toISOString(),
    current: {
      temperatureC: hourSeries.temperature[peakIdx],
      heatIndexC: hourSeries.heatIndex[peakIdx],
      apparentTempC: hourSeries.apparentTemp[peakIdx],
      wetBulbC: hourSeries.wetBulb[peakIdx],
      humidity: hourSeries.humidity[peakIdx],
      precipitation: rnd() < 0.25 ? Math.round(rnd() * 4 * 10) / 10 : 0,
      cloudCover: Math.round(rnd() * 7 + 1),
      aqi: Math.round(28 + rnd() * 35),
      no2: Math.round(8 + rnd() * 25),
      o3: Math.round(25 + rnd() * 40),
      pm25: Math.round(6 + rnd() * 14),
      pm10: Math.round(12 + rnd() * 22),
      co2Ppm: Math.round(410 + rnd() * 40),
      solarIrradiance: Math.round(80 + rnd() * 850),
      methanePpb: Math.round(1880 + rnd() * 120),
    },
    hourly: hourSeries,
  };
}

// NOTE: a demoRoutes() fabricator used to live here. It drew synthetic
// straight-line geometries that crossed open water and invented three
// "alternatives" from one curve. Routes are ALWAYS real OSRM geometry now
// (see backend/api.js /api/routes) — do not reintroduce fabricated routes.

module.exports = { demoHeatmap, demoEnv };