// THERMA internal data model.
// Normalizes raw FortyGuard payloads into a clean, consistent structure the
// frontend can render. Every object carries a `source` field so the UI can
// clearly distinguish FORTYGUARD DATA from THERMA ANALYSIS.

function deepCoordToNumbers(rings) {
  return rings.map((ring) => ring.map((p) => [Number(p[0]), Number(p[1])]));
}

function polygonBounds(feature) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const coords = feature.geometry && feature.geometry.coordinates;
  if (!coords) return null;
  for (const ring of coords) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (minLon === Infinity) return null;
  return [[minLon, minLat], [maxLon, maxLat]];
}

function featureCenter(feature) {
  const b = polygonBounds(feature);
  if (!b) return null;
  return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
}

const C_TO_F = (c) => (c * 9) / 5 + 32;
const F_TO_C = (f) => ((f - 32) * 5) / 9;

function toNumberList(v) {
  if (Array.isArray(v)) return v.map(Number).filter((n) => !isNaN(n));
  if (typeof v === 'string') return v.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  return [];
}

function classifyExposure(value, { units } = {}) {
  // Generic 5-band risk used across layers. For temperature layers the bands
  // are temperature bands; for count/duration layers they are hour bands.
  let bands, label, color;
  if (units === 'celsius') {
    bands = [
      { max: 28, label: 'Cool', color: '#2b7de9' },
      { max: 30, label: 'Mild', color: '#57b1ff' },
      { max: 32, label: 'Warm', color: '#fed7aa' },
      { max: 35, label: 'Hot', color: '#f97316' },
      { max: Infinity, label: 'Extreme', color: '#b91c1c' },
    ];
  } else if (units === 'hour') {
    bands = [
      { max: 2, label: 'Low', color: '#2b7de9' },
      { max: 4, label: 'Moderate', color: '#57b1ff' },
      { max: 6, label: 'Elevated', color: '#fed7aa' },
      { max: 9, label: 'High', color: '#f97316' },
      { max: Infinity, label: 'Critical', color: '#b91c1c' },
    ];
  } else {
    bands = [
      { max: 0.2, label: 'Low', color: '#2b7de9' },
      { max: 0.4, label: 'Moderate', color: '#57b1ff' },
      { max: 0.6, label: 'Elevated', color: '#fed7aa' },
      { max: 0.8, label: 'High', color: '#f97316' },
      { max: Infinity, label: 'Critical', color: '#b91c1c' },
    ];
  }
  const band = bands.find((b) => value <= b.max) || bands[bands.length - 1];
  return { band: band.label, color: band.color, index: bands.indexOf(band) + 1 };
}

function normalizeHeatmap(raw, { source = 'fortyguard', location } = {}) {
  const mapData = raw && raw.map_data ? raw.map_data : null;
  const statsData = raw && raw.stats_data ? raw.stats_data : {};

  const isAnalysis = statsData.analytic_type && statsData.analytic_type !== 'tcm';
  const units = isAnalysis ? 'hour' : 'celsius';

  const stats = !isAnalysis
    ? (statsData.temperature_stats || {})
    : { min: statsData.min, max: statsData.max, mean: statsData.mean, n_cells: statsData.n_cells };

  const tiles = (mapData && Array.isArray(mapData.features) ? mapData.features : []).map((f, i) => {
    const p = f.properties || {};
    const avg = isAnalysis ? p.value : p.average_temperature;
    const min = isAnalysis ? null : p.min_temperature;
    const max = isAnalysis ? null : p.max_temperature;
    const center = featureCenter(f);
    return {
      id: p.tile_id ?? i,
      center: center ? { lon: center[0], lat: center[1] } : null,
      bounds: polygonBounds(f),
      value: avg,
      min,
      max,
      c: avg,
      f: avg != null ? C_TO_F(avg) : null,
      layer: classifyExposure(avg, { units }),
      geometry: {
        type: f.geometry && f.geometry.type,
        coordinates: f.geometry ? deepCoordToNumbers(f.geometry.coordinates) : null,
      },
    };
  });

  const valid = tiles.filter((t) => t.value != null);
  const computedMin = stats.min != null ? stats.min : (valid.length ? Math.min(...valid.map((t) => t.value)) : null);
  const computedMax = stats.max != null ? stats.max : (valid.length ? Math.max(...valid.map((t) => t.value)) : null);
  const computedMean = stats.mean != null ? stats.mean : (valid.length ? valid.reduce((s, t) => s + t.value, 0) / valid.length : null);

  return {
    source,
    kind: isAnalysis ? statsData.analytic_type : 'temperature',
    layer: isAnalysis ? statsData.analytic_type : 'temperature',
    units,
    location,
    activityId: statsData.activity_id || null,
    fetchedAt: new Date().toISOString(),
    stats: {
      min: computedMin,
      max: computedMax,
      mean: computedMean,
      std: stats.standard_deviation ?? null,
      n: valid.length,
    },
    distribution: isAnalysis
      ? null
      : {
          overall: Array.isArray(statsData.overall_temperature_distribution)
            ? statsData.overall_temperature_distribution
            : null,
          frequency: statsData.temperature_frequency
            ? {
                axis: toNumberList(statsData.temperature_frequency.x_axis),
                counts: toNumberList(statsData.temperature_frequency.y_axis),
              }
            : null,
        },
    grid: tiles,
  };
}

function normalizeEnv(raw, { source = 'fortyguard', location } = {}) {
  // FortyGuard /v1/env_params result shape:
  //   { metadata: { timestamps: [24 ISO hours], timezone_offset_hours, time_range },
  //     locations: [ { lat, lon, temperature, parameters: { <analysis_key>: [24 values] } } ] }
  // Legacy/demo payloads may instead be a flat array of hourly records — both
  // are normalized to the same { current, hourly } contract.
  const result = raw || {};
  const loc0 = Array.isArray(result.locations) ? result.locations[0] : null;
  const params = (loc0 && loc0.parameters) || null;
  const meta = result.metadata || {};

  let pick;
  let nowIdx = -1;
  if (params) {
    pick = (key) => (Array.isArray(params[key]) ? params[key].map((v) => (v != null ? Number(v) : null)) : []);
    // "Current" = the hour of this series closest to now (series starts at
    // 00:00 in the location's own timezone).
    if (typeof meta.timezone_offset_hours === 'number') {
      const localHour = ((Math.floor(Date.now() / 3600000) % 24) + meta.timezone_offset_hours + 24) % 24;
      const len = (meta.timestamps || []).length || 24;
      if (localHour < len) nowIdx = localHour;
    }
  } else {
    const data = result.data && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
    pick = (key) => data.map((p) => (p[key] != null ? Number(p[key]) : null));
  }
  const nowOrLast = (key) => {
    const a = pick(key).filter((v) => v == null || Number.isFinite(v));
    if (!a.length) return null;
    if (nowIdx >= 0 && a[nowIdx] != null) return a[nowIdx];
    for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i];
    return null;
  };

  return {
    source,
    kind: 'environment',
    units: 'mixed',
    location,
    fetchedAt: new Date().toISOString(),
    current: {
      temperatureC: loc0 && loc0.temperature != null ? Number(loc0.temperature) : nowOrLast('temperature_celsius'),
      heatIndexC: nowOrLast('heat_index_celsius'),
      apparentTempC: nowOrLast('apparent_temperature_celsius'),
      wetBulbC: nowOrLast('wet_bulb_temperature_celsius'),
      humidity: nowOrLast('relative_humidity_percent'),
      precipitation: nowOrLast('precipitation_mm'),
      cloudCover: nowOrLast('cloud_cover_octas'),
      aqi: nowOrLast('air_quality:idx'),
      no2: nowOrLast('air_quality_no2:idx'),
      o3: nowOrLast('air_quality_o3:idx'),
      pm25: nowOrLast('air_quality_pm2p5:idx'),
      pm10: nowOrLast('air_quality_pm10:idx'),
      co2Ppm: nowOrLast('co2_ppm'),
      solarIrradiance: nowOrLast('solar_irradiance'),
      methanePpb: nowOrLast('methane_ppb'),
    },
    hourly: {
      heatIndex: pick('heat_index_celsius'),
      apparentTemp: pick('apparent_temperature_celsius'),
      wetBulb: pick('wet_bulb_temperature_celsius'),
      humidity: pick('relative_humidity_percent'),
      temperature: pick('temperature_celsius'),
    },
  };
}

function normalizeSatellite(raw, { source = 'fortyguard', location } = {}) {
  const analysis = raw && raw.analysis ? raw.analysis : raw;
  return {
    source,
    kind: 'satellite',
    location,
    fetchedAt: new Date().toISOString(),
    data: analysis,
  };
}

function normalizeStreetView(raw, { source = 'fortyguard', location } = {}) {
  return {
    source,
    kind: 'streetview',
    location,
    fetchedAt: new Date().toISOString(),
    data: raw && raw.data ? raw.data : raw,
  };
}

// Risk/exposure rubric applied over a normalized heatmap + env context.
// Clearly a THERMA ANALYSIS product — never passed off as raw FortyGuard data.
function analyzeExposure({ heatmap, env, locationLabel, scenarioOverride = null }) {
  const stats = heatmap ? heatmap.stats : null;
  const t = stats ? stats.mean : null;
  const hi = env && env.current ? env.current.heatIndexC : null;
  const hum = env && env.current ? env.current.humidity : null;

  const tempRisk = t == null ? null : classifyExposure(t, { units: 'celsius' });
  const stressDriver = [];
  if (hi != null && t != null && hi - t >= 3) stressDriver.push('heat index elevation');
  if (hum != null && hum >= 65) stressDriver.push('high humidity');
  if (t != null && t >= 32) stressDriver.push('air temperature above 32°C');

  const score = Math.round(
    ((tempRisk ? tempRisk.index : 2) / 5) * 100
  );
  const level = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Moderate' : score >= 20 ? 'Low' : 'Minimal';

  return {
    source: 'therma-analysis',
    label: 'THERMA heat exposure analysis',
    location: locationLabel,
    scenario: scenarioOverride ? 'THERMA SCENARIO ESTIMATE' : null,
    level,
    score,
    drivers: stressDriver,
    temperature: t,
    heatIndex: hi,
    humidity: hum,
    bands: tempRisk ? { level: tempRisk.band, color: tempRisk.color, index: tempRisk.index } : null,
  };
}

module.exports = {
  normalizeHeatmap,
  normalizeEnv,
  normalizeSatellite,
  normalizeStreetView,
  analyzeExposure,
  classifyExposure,
  C_TO_F,
  F_TO_C,
};