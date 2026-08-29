// THERMA report builder. Produces a self-contained HTML report from the
// normalized application context (heat data, environment, assets, alerts,
// recommendations). Never invents unsupported metrics.

let seq = 0;
const reports = new Map(); // id -> {html, meta}

const C_TO_F = (c) => (c * 9) / 5 + 32;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeNum(n) { return n != null ? Number(n) : null; }
function safeToFixed(num) { return num != null ? Number(num).toFixed(1) : '—'; }
function safeToFixedF(num) { return num != null ? C_TO_F(Number(num)).toFixed(1) : '—'; }
// A temperature DIFFERENCE converts by ratio only — no +32 offset.
function safeDeltaF(num) { return num != null ? ((Number(num) * 9) / 5).toFixed(1) : '—'; }
function safeDisplay(d) { return d != null ? String(d) : '—'; }
function safeRound(n) { return n != null ? Math.round(n) : null; }

// Normalizes the context's hourly series into ONE canonical array:
//   [{ hour, value(°C), heatIndex(°C), humidity(%), apparentTemp(°C), wetBulb(°C) }]
// The live THERMA context exposes `environment.hourly` as an object of parallel
// 24-element arrays keyed by metric; other payloads use an array of {hour,value}.
// Both are accepted. Metrics that are absent stay null — never substituted.
function normalizeHourly(hm, env) {
  const fromArray = (arr) => arr.map(function(h, i) {
    if (h != null && typeof h === 'object') {
      return {
        hour: h.hour != null ? Number(h.hour) : i,
        value: safeNum(h.value != null ? h.value : h.temperature),
        heatIndex: safeNum(h.heatIndex != null ? h.heatIndex : h.heatIndexC),
        humidity: safeNum(h.humidity),
        apparentTemp: safeNum(h.apparentTemp),
        wetBulb: safeNum(h.wetBulb != null ? h.wetBulb : h.wetBulbC),
      };
    }
    return { hour: i, value: safeNum(h), heatIndex: null, humidity: null, apparentTemp: null, wetBulb: null };
  });

  if (hm && Array.isArray(hm.hourly) && hm.hourly.length) return fromArray(hm.hourly);

  const eh = env ? env.hourly : null;
  if (Array.isArray(eh) && eh.length) return fromArray(eh);

  if (eh && typeof eh === 'object') {
    const keys = ['temperature', 'heatIndex', 'humidity', 'apparentTemp', 'wetBulb'];
    const len = Math.max.apply(Math, keys.map((k) => (Array.isArray(eh[k]) ? eh[k].length : 0)));
    if (!len || !Number.isFinite(len)) return [];
    const at = (k, i) => {
      const v = Array.isArray(eh[k]) ? eh[k][i] : null;
      return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
    };
    const out = [];
    for (let i = 0; i < len; i++) {
      out.push({
        hour: i,
        value: at('temperature', i),
        heatIndex: at('heatIndex', i),
        humidity: at('humidity', i),
        apparentTemp: at('apparentTemp', i),
        wetBulb: at('wetBulb', i),
      });
    }
    return out;
  }
  return [];
}

// The stage the builder most recently entered. api.js reports it alongside a
// failure so an exception names the stage it died in rather than a bare 500.
// Only ever holds a fixed stage label — never context data, never credentials.
let currentStage = 'UNSTARTED';
function lastStage() { return currentStage; }

function logging(msg, ctx) {
  currentStage = String(msg);
  try {
    const dc = ctx && ctx.location ? ctx.location.display : 'no-location';
    console.log('[REPORT] ' + msg + '  location=' + dc);
  } catch { console.log('[REPORT] ' + msg); }
}

function svgBarChart(items, { width = 620, height = 220, color = '#f97316' } = {}) {
  if (!items || !items.length) return '';
  const pad = 30;
  const iw = width - pad * 2;
  const ih = height - pad * 2;
  const values = items.map((i) => i.value);
  const max = Math.max(...values) || 1;
  const n = items.length;
  const bw = Math.max(6, iw / n - 8);
  const bars = items
    .map((it, i) => {
      const h = Math.max(2, (it.value / max) * ih);
      const x = pad + i * (iw / n) + (iw / n - bw) / 2;
      const y = pad + ih - h;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="' + (it.color || color) + '"/><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" fill="#444748">' + it.label + '</text>';
    })
    .join('');
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" style="max-width:' + width + 'px">' + bars + '</svg>';
}

// ---- Missing-data audit ----

function classifyData(dataObj, label) {
  if (dataObj == null) return { status: 'MISSING', label };
  if (typeof dataObj === 'number') {
    return { status: Number.isFinite(dataObj) ? 'AVAILABLE' : 'INVALID', label };
  }
  if (Array.isArray(dataObj)) {
    if (dataObj.length === 0) return { status: 'MISSING', label };
    const statuses = dataObj.map((v) => classifyData(v, label));
    const allAvail = statuses.every(s => s.status === 'AVAILABLE');
    const anyInval = statuses.some(s => s.status === 'INVALID');
    if (allAvail) return { status: 'AVAILABLE', label };
    if (anyInval) return { status: 'INVALID', label };
    return { status: 'OPTIONAL', label };
  }
  if (typeof dataObj === 'object') {
    const vals = Object.values(dataObj).filter(v => v != null);
    if (vals.length === 0) return { status: 'MISSING', label };
    const statuses = vals.map(v => classifyData(v, label));
    const allAvail = statuses.every(s => s.status === 'AVAILABLE');
    if (allAvail) return { status: 'AVAILABLE', label };
    return { status: 'OPTIONAL', label };
  }
  if (typeof dataObj === 'string') {
    return dataObj.trim() === '' ? { status: 'MISSING', label } : { status: 'AVAILABLE', label };
  }
  return { status: 'OPTIONAL', label };
}

function auditMissingData(hm, env, exp, assets, alerts, recs, stats, cur) {
  const audit = {
    available: [],
    derivable: [],
    optional: [],
    missing: [],
    invalid: []
  };

  const thermalEntries = [];
  if (stats && stats.mean != null) thermalEntries.push({ name: 'meanTemperature', value: stats.mean });
  if (stats && stats.max != null) thermalEntries.push({ name: 'maxTemperature', value: stats.max });
  if (stats && stats.min != null) thermalEntries.push({ name: 'minTemperature', value: stats.min });
  if (thermalEntries.length > 0) {
    const allAvail = thermalEntries.every(e => safeNum(e.value) != null);
    audit.available.push({ group: 'thermal', items: thermalEntries.map(e => e.name) });
  }

  if (cur && cur.heatIndexC != null) {
    audit.available.push({ group: 'environment', items: ['heatIndex'] });
  }

  if (cur && cur.humidity != null) {
    audit.available.push({ group: 'environment', items: ['humidity'] });
  }

  if (exp && exp.score != null) {
    audit.available.push({ group: 'exposure', items: ['exposureScore'] });
  }

  if (assets && assets.length > 0) {
    audit.available.push({ group: 'assets', items: ['assets', assets.length] });
  } else {
    audit.optional.push({ group: 'assets', items: ['assets'] });
  }

  if (alerts && alerts.length > 0) {
    audit.available.push({ group: 'alerts', items: ['alerts', alerts.length] });
  } else {
    audit.optional.push({ group: 'alerts', items: ['alerts'] });
  }

  if (recs && recs.length > 0) {
    audit.available.push({ group: 'recommendations', items: ['recommendations', recs.length] });
  } else {
    audit.optional.push({ group: 'recommendations', items: ['recommendations'] });
  }

  if (cur && (cur.temperatureC != null || cur.temperature != null)) audit.available.push({ group: 'environment', items: ['currentTemperature'] });
  if (cur && cur.humidity != null) audit.available.push({ group: 'environment', items: ['currentHumidity'] });
  if (cur && cur.windSpeed != null) audit.available.push({ group: 'environment', items: ['currentWind'] });
  else audit.missing.push({ group: 'wind', items: ['currentWind'] });
  if (cur && cur.heatIndexC != null) audit.available.push({ group: 'environment', items: ['currentHeatIndex'] });

  if (stats) {
    if (stats.mean != null && stats.max != null) {
      audit.derivable.push({
        name: 'temperatureRange',
        value: safeRound(stats.max - stats.min),
        source: ['minTemperature', 'maxTemperature'],
        method: 'max - min'
      });
    }
    if (stats.mean != null) {
      audit.derivable.push({
        name: 'meanTemperature',
        value: safeNum(stats.mean),
        source: ['statisticsMean'],
        method: 'statistics provided'
      });
    }
  }

  return audit;
}

function computeOutdoorSuitability(hourlyData, riskBands) {
  if (!hourlyData || !hourlyData.length) return { period: '—', classification: '—', rationale: 'No hourly data available for suitability analysis.' };

  const data = [...hourlyData].sort(function(a, b) {
    var ah = typeof a === 'object' ? a.hour : a;
    var bh = typeof b === 'object' ? b.hour : b;
    return Number(ah) - Number(bh);
  });

  var samples = data.filter(function(d) {
    var v = typeof d === 'object' ? (d.value != null ? d.value : null) : d;
    return v != null && !isNaN(v);
  }).map(function(d, i) {
    return { hour: typeof d === 'object' && d.hour != null ? Number(d.hour) : i, c: Number(typeof d === 'object' ? d.value : d) };
  });
  var temps = samples.map(function(s) { return s.c; });

  if (temps.length === 0) return { period: '—', classification: '—', rationale: 'No parseable temperature values in hourly data.' };

  // Hourly values are Celsius; the risk bands below are expressed in °F.
  var meanTemp = safeRound(C_TO_F(temps.reduce(function(sum, v) { return sum + v; }, 0) / temps.length));
  var maxTemp = safeRound(C_TO_F(Math.max.apply(Math, temps)));
  var minTemp = safeRound(C_TO_F(Math.min.apply(Math, temps)));

  var bands = riskBands || {
    low: { max: 80, label: 'LOWER THERMAL EXPOSURE', description: 'Conditions favorable for outdoor activity.' },
    moderate: { min: 80, max: 90, label: 'ELEVATED', description: 'Heat is increasing; take precautions.' },
    high: { min: 90, max: 100, label: 'HIGH', description: 'Extended outdoor activity may be uncomfortable.' },
    veryHigh: { min: 100, label: 'VERY HIGH', description: 'Conditions unfavorable for extended outdoor activity.' }
  };

  var classification = '—';
  var period = '—';
  var rationale = '';

  var coolest = samples.reduce(function(a, b) { return b.c < a.c ? b : a; }, samples[0]);
  var hottest = samples.reduce(function(a, b) { return b.c > a.c ? b : a; }, samples[0]);
  var hh = function(h) { return ('0' + h).slice(-2) + ':00'; };
  var coolWindow = 'most suitable near ' + hh(coolest.hour) + ' (' + minTemp + '°F)';

  if (maxTemp >= bands.veryHigh.min) {
    classification = bands.veryHigh.label;
    period = 'Peak ' + hh(hottest.hour) + ' at ' + maxTemp + '°F — ' + coolWindow;
    rationale = bands.veryHigh.description;
  } else if (maxTemp >= bands.high.min) {
    classification = bands.high.label;
    period = 'Peak ' + hh(hottest.hour) + ' at ' + maxTemp + '°F — ' + coolWindow;
    rationale = bands.high.description;
  } else if (maxTemp >= bands.moderate.min) {
    classification = bands.moderate.label;
    period = 'Peak ' + hh(hottest.hour) + ' at ' + maxTemp + '°F — ' + coolWindow;
    rationale = bands.moderate.description;
  } else {
    classification = bands.low.label;
    period = 'Range ' + minTemp + '–' + maxTemp + '°F — ' + coolWindow;
    rationale = bands.low.description;
  }

  return { period: period, classification: classification, rationale: rationale };
}

function buildReport(context, { include = {} } = {}) {
  logging('BUILD_START', context);
  var now = new Date();
  var id = 'R-' + now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + '-' + ('000' + (++seq)).slice(-3);

  logging('DATA_COLLECT_START', context);
  var loc = context && context.location ? context.location : {};
  var hm = context && context.heatmap ? context.heatmap : {};
  var env = context && context.environment ? context.environment : {};
  var exp = context && context.exposure ? context.exposure : {};
  var assets = context && context.assets ? context.assets : [];
  var alerts = context && context.alerts ? context.alerts : [];
  var recs = context && context.recommendations ? context.recommendations : [];
  var stats = hm && hm.stats ? hm.stats : {};
  var cur = env && env.current ? env.current : {};
  var hourly = normalizeHourly(hm, env);
  logging('DATA_COLLECT_COMPLETE', { hourlyCount: hourly.length, hasStats: !!(stats && stats.mean) });

  logging('DATASET_BUILD_START', context);
  // The analysis window is supplied by the caller (Reports screen / Zoe). It is
  // validated to whole hours 0-23 here so a malformed value can neither skew
  // the analysis nor reach the HTML. No silent default is applied.
  var toHour = function(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return null;
    n = Math.round(n);
    return n >= 0 && n <= 23 ? n : null;
  };
  var rwRaw = context && context.requestedWindow ? context.requestedWindow : null;
  var requestedWindow = null;
  if (rwRaw) {
    var rwStart = toHour(rwRaw.start);
    var rwEnd = toHour(rwRaw.end);
    if (rwStart != null && rwEnd != null) {
      if (rwEnd < rwStart) { var swap = rwStart; rwStart = rwEnd; rwEnd = swap; }
      requestedWindow = { start: rwStart, end: rwEnd, duration: rwEnd - rwStart + 1 };
    }
  }
  var hhmm = function(h) { return ('0' + h).slice(-2) + ':00'; };
  var windowLabel = requestedWindow
    ? hhmm(requestedWindow.start) + ' – ' + hhmm(requestedWindow.end) + ' (' + requestedWindow.duration + ' h)'
    : 'Not selected';

  var reportDataset = {
    metadata: {
      id: id,
      generatedAt: now.toISOString(),
      source: context && context.demo ? 'demo' : context && context.source === 'live' ? 'live' : 'therma',
      session: context && context.demo ? 'demo-session' : 'active'
    },
    location: {
      display: safeDisplay(loc.display),
      county: safeDisplay(loc.county),
      region: safeDisplay(loc.region),
      latitude: safeNum(loc.latitude != null ? loc.latitude : loc.lat),
      longitude: safeNum(loc.longitude != null ? loc.longitude : loc.lon),
      selectedCell: safeNum(loc.selectedCell)
    },
    requestedWindow: requestedWindow,
    thermal: {
      stats: stats,
      surfaceTemp: safeNum(stats && stats.mean),
      minTemp: safeNum(stats && stats.min),
      maxTemp: safeNum(stats && stats.max),
      range: stats && stats.mean != null && stats.max != null ? safeRound(stats.max - stats.min) : null
    },
    environment: {
      current: cur,
      // Live context carries these on environment.current, NOT heatmap.current.
      temperatureC: safeNum(cur.temperatureC != null ? cur.temperatureC : cur.temperature),
      humidity: safeNum(cur.humidity),
      heatIndexC: safeNum(cur.heatIndexC),
      heatIndexF: cur.heatIndexC != null ? safeNum(C_TO_F(Number(cur.heatIndexC))) : null,
      windSpeed: safeNum(cur.windSpeed),
      precipitation: safeNum(cur.precipitation),
      aqi: safeNum(cur.aqi),
      solarIrradiance: safeNum(cur.solarIrradiance),
      wetBulb: safeNum(cur.wetBulbC != null ? cur.wetBulbC : cur.wetBulb),
      hourly: hourly
    },
    alerts: alerts,
    assets: assets,
    derivedMetrics: [],
    missingData: {},
    dataQuality: {}
  };
  logging('DATASET_BUILD_COMPLETE', { requestedWindow: !!context && context.requestedWindow });

  logging('AUDIT_START', context);
  var audit = auditMissingData(hm, env, exp, assets, alerts, recs, stats, cur);
  reportDataset.missingData = audit;
  logging('AUDIT_COMPLETE', context);

  var categoryStatuses = {};
  audit.available.forEach(function(item) { categoryStatuses[item.group] = categoryStatuses[item.group] || 'AVAILABLE'; });
  audit.derivable.forEach(function(item) { categoryStatuses[item.group] = categoryStatuses[item.group] || 'DERIVABLE'; });
  audit.optional.forEach(function(item) { categoryStatuses[item.group] = categoryStatuses[item.group] || 'OPTIONAL'; });
  audit.missing.forEach(function(item) { categoryStatuses[item.group] = categoryStatuses[item.group] || 'MISSING'; });
  audit.invalid.forEach(function(item) { categoryStatuses[item.group] = categoryStatuses[item.group] || 'INVALID'; });

  reportDataset.derivedMetrics = audit.derivable.map(function(d) {
    // Any finite value is reported as-is. A legitimate 0 is data, not a gap.
    return {
      name: d.name,
      value: d.value != null && Number.isFinite(Number(d.value)) ? Number(d.value) : '—',
      source: d.source,
      method: d.method
    };
  });

  // CRITICAL 1: requestedWindow only from context; no silent defaults
  logging('WINDOW_RESOLVED', { requestedWindow: !!requestedWindow, windowLabel: windowLabel });

  logging('ANALYSIS_START', { requestedWindow: !!requestedWindow, hourlyCount: hourly.length });
  var windowAnalysis = {};

  if (requestedWindow && hourly && hourly.length > 0) {
    var windowSamples = hourly.filter(function(h) {
      var hourVal = typeof h === 'object' ? (h.hour != null ? Number(h.hour) : null) : Number(h);
      return hourVal != null && hourVal >= (requestedWindow.start != null ? requestedWindow.start : 0) &&
                     hourVal <= (requestedWindow.end != null ? requestedWindow.end : 23);
    });

    if (windowSamples.length > 0) {
      var windowTemps = windowSamples.map(function(h) {
        var v = typeof h === 'object' ? h.value != null ? Number(h.value) : null : Number(h);
        return v != null ? v : null;
      }).filter(function(v) { return v != null && !isNaN(v); });

      windowAnalysis = {
        sampleCount: windowSamples.length,
        startHour: requestedWindow.start != null ? requestedWindow.start : '—',
        endHour: requestedWindow.end != null ? requestedWindow.end : '—',
        meanTemp: windowTemps.length > 0 ? windowTemps.reduce(function(s, v) { return s + v; }, 0) / windowTemps.length : null,
        minTemp: windowTemps.length > 0 ? Math.min.apply(Math, windowTemps) : null,
        maxTemp: windowTemps.length > 0 ? Math.max.apply(Math, windowTemps) : null,
        range: windowTemps.length > 0 ? Math.max.apply(Math, windowTemps) - Math.min.apply(Math, windowTemps) : null,
        trend: windowTemps.length >= 2
          ? windowTemps[windowTemps.length - 1] - windowTemps[0]
          : null,
        hoursAboveThreshold: windowTemps.filter(function(v) { return C_TO_F(v) >= 90; }).length,
        maxHour: (function() {
          var best = null;
          windowSamples.forEach(function(h) {
            var v = typeof h === 'object' ? (h.value != null ? Number(h.value) : null) : Number(h);
            if (v == null || isNaN(v)) return;
            if (best === null || v > best.v) best = { v: v, hour: typeof h === 'object' && h.hour != null ? Number(h.hour) : null };
          });
          return best ? best.hour : null;
        })(),
        percentageAboveThreshold: windowTemps.length > 0
          ? safeRound((windowTemps.filter(function(v) { return C_TO_F(v) >= 90; }).length / windowTemps.length) * 100)
          : 0
      };
    }
  }
  logging('ANALYSIS_COMPLETE', { sampleCount: windowAnalysis.sampleCount });

  // ---- 7. OUTDOOR SUITABILITY ANALYSIS ----
  logging('SUITABILITY_START', context);
  var suitabilityHourly = requestedWindow && hourly && hourly.length > 0
    ? hourly.filter(function(h) {
        var hourVal = typeof h === 'object' ? (h.hour != null ? Number(h.hour) : null) : Number(h);
        return hourVal != null && hourVal >= (requestedWindow.start != null ? requestedWindow.start : 0) &&
                       hourVal <= (requestedWindow.end != null ? requestedWindow.end : 23);
      })
    : hourly;

  var existingRiskBands = exp && exp.level
    ? { low: { max: 80, label: 'LOWER THERMAL EXPOSURE', description: 'Conditions favorable for outdoor activity.' },
        moderate: { min: 80, max: 90, label: 'ELEVATED', description: 'Heat is increasing; take precautions.' },
        high: { min: 90, max: 100, label: 'HIGH', description: 'Extended outdoor activity may be uncomfortable.' },
        veryHigh: { min: 100, label: 'VERY HIGH', description: 'Conditions unfavorable for extended outdoor activity.' } }
    : null;

  var suitability = computeOutdoorSuitability(suitabilityHourly, existingRiskBands);
  logging('SUITABILITY_COMPLETE', { classification: suitability.classification, riskBandsSource: existingRiskBands ? 'existing' : 'default' });

  reportDataset.dataQuality = reportDataset.dataQuality || {};
  reportDataset.dataQuality.warnings = reportDataset.dataQuality.warnings || [];
  if (!existingRiskBands) {
    reportDataset.dataQuality.warnings.push('Outdoor suitability uses default thermal risk bands; no existing THERMA risk-band configuration found in context.');
  }

  // ---- 8. GRAPHICAL REPRESENTATION ----
  logging('GRAPHS_START', { requestedWindow: !!requestedWindow, hourlyCount: hourly.length });
  var tempChart = '';
  var heatIndexChart = '';
  var humidityChart = '';
  var windChart = '';

  // All charts are driven by the normalized hourly series and are only drawn
  // for the requested window (CRITICAL 1, 5). A metric absent from the source
  // yields no chart — never a substituted value (CRITICAL 3).
  var inWindow = function(h) {
    if (!requestedWindow) return false;
    var hourVal = h != null && typeof h === 'object' && h.hour != null ? Number(h.hour) : null;
    if (hourVal == null || isNaN(hourVal)) return false;
    return hourVal >= (requestedWindow.start != null ? requestedWindow.start : 0) &&
           hourVal <= (requestedWindow.end != null ? requestedWindow.end : 23);
  };
  var seriesFor = function(field) {
    return hourly.filter(inWindow)
      .filter(function(h) { return h[field] != null && Number.isFinite(Number(h[field])); })
      .map(function(h) { return { label: ('0' + h.hour).slice(-2), value: Number(h[field]) }; });
  };

  if (requestedWindow && hourly.length > 0) {
    var tempSeries = seriesFor('value').map(function(p) { return { label: p.label, value: Number(C_TO_F(p.value).toFixed(1)) }; });
    if (tempSeries.length > 0) tempChart = svgBarChart(tempSeries, { width: 600, height: 200, color: '#2b7de9' });

    var hiSeries = seriesFor('heatIndex').map(function(p) { return { label: p.label, value: Number(C_TO_F(p.value).toFixed(1)) }; });
    if (hiSeries.length > 0) heatIndexChart = svgBarChart(hiSeries, { width: 600, height: 200, color: '#f97316' });

    var humSeries = seriesFor('humidity');
    if (humSeries.length > 0) humidityChart = svgBarChart(humSeries, { width: 600, height: 200, color: '#10b981' });

    var wbSeries = seriesFor('wetBulb').map(function(p) { return { label: p.label, value: Number(C_TO_F(p.value).toFixed(1)) }; });
    if (wbSeries.length > 0) windChart = svgBarChart(wbSeries, { width: 600, height: 200, color: '#8b5cf6' });
  }
  logging('GRAPHS_COMPLETE', { tempChartLen: tempChart.length, hiChartLen: heatIndexChart.length, humChartLen: humidityChart.length, windChartLen: windChart.length });

  // ---- 9. TEXTUAL INTERPRETATION ----
  logging('TEXT_START', context);
  var textualParts = [];

  if (windowAnalysis.meanTemp != null) {
    textualParts.push('Between ' + hhmm(windowAnalysis.startHour) + ' and ' + hhmm(windowAnalysis.endHour) + ', the mean temperature was ' + safeToFixed(windowAnalysis.meanTemp) + '°C / ' + safeToFixedF(windowAnalysis.meanTemp) + '°F.');
    if (windowAnalysis.maxTemp != null) {
      textualParts.push('The maximum reached ' + safeToFixedF(windowAnalysis.maxTemp) + '°F' + (windowAnalysis.maxHour != null ? ' at ' + ('0' + windowAnalysis.maxHour).slice(-2) + ':00' : '') + ', representing a ' + safeDeltaF(windowAnalysis.maxTemp - windowAnalysis.meanTemp) + '°F increase above the window mean.');
    }
  }

  textualParts.push('Based on the available thermal conditions, ' + (suitability.classification.toLowerCase() || 'conditions as observed') + '. ' + (suitability.rationale || 'See detailed analysis within the report.'));

  if (reportDataset.derivedMetrics && reportDataset.derivedMetrics.length > 0) {
    textualParts.push('Derived metrics: ' + reportDataset.derivedMetrics.map(function(d) { return d.name + ': ' + safeDisplay(d.value); }).join(', ') + '.');
  }
  logging('TEXT_COMPLETE', { partCount: textualParts.length });

  // ---- 10. DATA QUALITY SECTION ----
  var availableCount = audit.available.length + audit.derivable.length;
  var unavailableCount = audit.missing.length + audit.invalid.length;

  reportDataset.dataQuality = {
    source: reportDataset.metadata.source,
    window: windowLabel,
    observations: audit.available.length + audit.derivable.length + audit.optional.length + audit.missing.length,
    available: availableCount,
    derived: audit.derivable.length,
    unavailable: unavailableCount,
    warnings: [
      audit.missing.map(function(m) { return m.group + ': unavailable'; }).join(','),
      audit.invalid.map(function(i) { return i.group + ': invalid data'; }).join(',')
    ]
  };

  // ---- Build HTML report ----
  var sourceLabel = context && context.demo ? 'DEMO DATA (clearly labeled, not live)' :
    context && context.source === 'live' ? 'FORTYGUARD DATA' : 'THERMA ANALYSIS';

  var card = function(t, v, sub) {
    return '<div class="card"><div class="k">' + esc(t) + '</div><div class="v">' + esc(v != null && v !== undefined ? v : '—') + '</div>' + (sub ? '<div class="s">' + esc(sub != null && sub !== undefined ? sub : '—') + '</div>' : '') + '</div>';
  };

  var sections = [];

  // 1. Executive Summary
  sections.push({
    title: 'Executive Summary',
    body: '<div class="grid3">' + card('Location', reportDataset.location.display || '—', reportDataset.location.county || reportDataset.location.region || '—') + '<div class="card"><div class="k">Analysis Window</div><div class="v">' + windowLabel + '</div></div><div class="card"><div class="k">Source</div><div class="v">' + sourceLabel + '</div></div>' + '</div><p>' + (windowAnalysis.sampleCount != null ? 'Analysis based on ' + windowAnalysis.sampleCount + ' hourly observation' + (windowAnalysis.sampleCount !== 1 ? 's' : '') + '.' : 'No analysis window was selected; window-dependent statistics are reported as unavailable.') + '</p>' + textualParts.map(function(p) { return '<p>' + esc(p) + '</p>'; }).join('')
  });

  // 2. Location & Analysis Window
  sections.push({
    title: 'Location & Analysis Window',
    body: '<p><b>Display:</b> ' + esc(reportDataset.location.display) + '</p><p><b>County/Region:</b> ' + esc(reportDataset.location.county || reportDataset.location.region || '—') + '</p><p><b>Latitude:</b> ' + (reportDataset.location.latitude !== null ? reportDataset.location.latitude : '—') + '</p><p><b>Longitude:</b> ' + (reportDataset.location.longitude !== null ? reportDataset.location.longitude : '—') + '</p><p><b>Analysis Window:</b> ' + esc(windowLabel || '—') + '</p>'
  });

  // 3. Data Quality
  sections.push({
    title: 'Data Quality',
    body: '<p><b>Source:</b> ' + esc(reportDataset.dataQuality.source) + '</p><p><b>Analysis window:</b> ' + esc(reportDataset.dataQuality.window) + '</p><p><b>Observations:</b> ' + reportDataset.dataQuality.observations + '</p><p><b>Available:</b> ' + reportDataset.dataQuality.available + ' metrics</p><p><b>Derived:</b> ' + reportDataset.dataQuality.derived + ' metrics</p><p><b>Unavailable:</b> ' + reportDataset.dataQuality.unavailable + ' metrics</p>' + (reportDataset.dataQuality.warnings.length > 0 ? '<p><b>Warnings:</b> ' + reportDataset.dataQuality.warnings.join(', ') + '</p>' : '')
  });

  // 4. Thermal Conditions
  var noWindowNote = '<p><i>Unavailable — no analysis window was selected, so window statistics could not be computed.</i></p>';
  var thermalSpatial = reportDataset.thermal.surfaceTemp != null
    ? '<p><b>Area mean surface temperature:</b> ' + safeToFixed(reportDataset.thermal.surfaceTemp) + '°C / ' + safeToFixedF(reportDataset.thermal.surfaceTemp) + '°F</p>' +
      '<p><b>Area minimum:</b> ' + safeToFixed(reportDataset.thermal.minTemp) + '°C / ' + safeToFixedF(reportDataset.thermal.minTemp) + '°F</p>' +
      '<p><b>Area maximum:</b> ' + safeToFixed(reportDataset.thermal.maxTemp) + '°C / ' + safeToFixedF(reportDataset.thermal.maxTemp) + '°F</p>' +
      (stats.std != null ? '<p><b>Spatial standard deviation:</b> ' + safeToFixed(stats.std) + '°C</p>' : '') +
      (stats.n != null ? '<p><b>Grid cells sampled:</b> ' + stats.n + '</p>' : '')
    : '<p><i>Unavailable — no thermal grid statistics in the supplied context.</i></p>';
  sections.push({
    title: 'Thermal Conditions',
    body: '<h3>Spatial (area of interest)</h3>' + thermalSpatial +
    '<h3>Temporal (selected analysis window)</h3>' +
    (windowAnalysis.meanTemp == null ? noWindowNote : '') +
    (windowAnalysis.meanTemp != null ? '<p><b>Mean temperature:</b> ' + safeToFixed(windowAnalysis.meanTemp) + '°C / ' + safeToFixedF(windowAnalysis.meanTemp) + '°F</p>' : '') +
    (windowAnalysis.minTemp != null ? '<p><b>Minimum:</b> ' + safeToFixed(windowAnalysis.minTemp) + '°C / ' + safeToFixedF(windowAnalysis.minTemp) + '°F</p>' : '') +
    (windowAnalysis.maxTemp != null ? '<p><b>Maximum:</b> ' + safeToFixed(windowAnalysis.maxTemp) + '°C / ' + safeToFixedF(windowAnalysis.maxTemp) + '°F</p>' : '') +
    (windowAnalysis.range != null ? '<p><b>Range:</b> ' + safeToFixed(windowAnalysis.range) + '°C / ' + safeDeltaF(windowAnalysis.range) + '°F</p>' : '') +
    (windowAnalysis.trend != null ? '<p><b>Trend:</b> ' + safeDeltaF(windowAnalysis.trend) + '°F ' + (windowAnalysis.trend >= 0 ? '(increasing)' : '(decreasing)') + '</p>' : '') +
    (windowAnalysis.hoursAboveThreshold != null ? '<p><b>Hours above 90°F threshold:</b> ' + windowAnalysis.hoursAboveThreshold + '</p>' : '') +
    (windowAnalysis.percentageAboveThreshold != null ? '<p><b>Percentage above 90°F:</b> ' + windowAnalysis.percentageAboveThreshold + '%</p>' : '')
  });

  // 5. Environmental Conditions
  var envRow = function(label, value, unavailableNote) {
    return '<p><b>' + esc(label) + ':</b> ' + (value != null ? value : '<i>Unavailable' + (unavailableNote ? ' — ' + esc(unavailableNote) : '') + '</i>') + '</p>';
  };
  sections.push({
    title: 'Environmental Conditions',
    body: envRow('Current temperature', reportDataset.environment.temperatureC != null ? safeToFixed(reportDataset.environment.temperatureC) + '°C / ' + safeToFixedF(reportDataset.environment.temperatureC) + '°F' : null) +
    envRow('Heat index', reportDataset.environment.heatIndexC != null ? safeToFixed(reportDataset.environment.heatIndexC) + '°C / ' + safeToFixedF(reportDataset.environment.heatIndexC) + '°F' : null) +
    envRow('Apparent temperature', cur.apparentTempC != null ? safeToFixed(cur.apparentTempC) + '°C / ' + safeToFixedF(cur.apparentTempC) + '°F' : null) +
    envRow('Wet bulb', reportDataset.environment.wetBulb != null ? safeToFixed(reportDataset.environment.wetBulb) + '°C / ' + safeToFixedF(reportDataset.environment.wetBulb) + '°F' : null) +
    envRow('Relative humidity', reportDataset.environment.humidity != null ? safeRound(reportDataset.environment.humidity) + '%' : null) +
    envRow('Wind speed', reportDataset.environment.windSpeed != null ? safeRound(reportDataset.environment.windSpeed) + ' km/h' : null, 'not provided by the environment source') +
    envRow('Precipitation', reportDataset.environment.precipitation != null ? safeToFixed(reportDataset.environment.precipitation) + ' mm' : null) +
    envRow('Cloud cover', cur.cloudCover != null ? safeRound(cur.cloudCover) + '%' : null) +
    envRow('Solar irradiance', reportDataset.environment.solarIrradiance != null ? safeRound(reportDataset.environment.solarIrradiance) + ' W/m²' : null) +
    envRow('Air quality index', reportDataset.environment.aqi != null ? safeRound(reportDataset.environment.aqi) : null) +
    envRow('PM2.5', cur.pm25 != null ? safeToFixed(cur.pm25) + ' µg/m³' : null) +
    envRow('PM10', cur.pm10 != null ? safeToFixed(cur.pm10) + ' µg/m³' : null)
  });

  // 6. Mathematical Analysis
  sections.push({
    title: 'Mathematical Analysis',
    body: (windowAnalysis.sampleCount == null ? noWindowNote : '') +
    (windowAnalysis.sampleCount != null ? '<p><b>Sample count:</b> ' + windowAnalysis.sampleCount + ' hourly observation' + (windowAnalysis.sampleCount !== 1 ? 's' : '') + '</p>' : '') +
    (windowAnalysis.meanTemp != null ? '<p><b>Mean:</b> ' + safeToFixed(windowAnalysis.meanTemp) + '°C</p>' : '') +
    (windowAnalysis.minTemp != null ? '<p><b>Min:</b> ' + safeToFixed(windowAnalysis.minTemp) + '°C</p>' : '') +
    (windowAnalysis.maxTemp != null ? '<p><b>Max:</b> ' + safeToFixed(windowAnalysis.maxTemp) + '°C</p>' : '') +
    (windowAnalysis.range != null ? '<p><b>Range:</b> ' + safeToFixed(windowAnalysis.range) + '°C</p>' : '') +
    (windowAnalysis.trend != null ? '<p><b>Delta:</b> ' + safeDeltaF(windowAnalysis.trend) + '°F</p>' : '') +
    (windowAnalysis.hoursAboveThreshold != null ? '<p><b>Hours above threshold:</b> ' + windowAnalysis.hoursAboveThreshold + ' hours</p>' : '') +
    (windowAnalysis.percentageAboveThreshold != null ? '<p><b>Percentage above threshold:</b> ' + windowAnalysis.percentageAboveThreshold + '%</p>' : '')
  });

  // 7. Graphs
  sections.push({
    title: 'Graphs',
    body: (tempChart ? '<div class="chart-container"><h3>Temperature vs Time (°F)</h3>' + tempChart + '</div>' : '') +
    (heatIndexChart ? '<div class="chart-container"><h3>Heat Index vs Time (°F)</h3>' + heatIndexChart + '</div>' : '') +
    (humidityChart ? '<div class="chart-container"><h3>Relative Humidity vs Time (%)</h3>' + humidityChart + '</div>' : '') +
    (windChart ? '<div class="chart-container"><h3>Wet Bulb Temperature vs Time (°F)</h3>' + windChart + '</div>' : '') +
    (!tempChart && !heatIndexChart && !humidityChart && !windChart
      ? '<p><i>' + (requestedWindow ? 'Insufficient data — no hourly observations fall inside the selected analysis window.' : 'Unavailable — no analysis window was selected, so no time series can be plotted.') + '</i></p>'
      : '<p class="s">Wind speed is not provided by the environment source and is therefore not charted.</p>')
  });

  // 8. Outdoor Suitability Window
  sections.push({
    title: 'Outdoor Suitability Window',
    body: '<p><b>Most suitable period:</b> ' + suitability.period + '</p><p><b>Classification:</b> ' + (suitability.classification || '—') + '</p><p><b>Rationale:</b> ' + (suitability.rationale || '—') + '</p>'
  });

  // 9. Peak Heat Period
  sections.push({
    title: 'Peak Heat Period',
    body: (windowAnalysis.maxTemp == null ? noWindowNote : '') +
    (windowAnalysis.maxTemp != null ? '<p><b>Peak temperature:</b> ' + safeToFixed(windowAnalysis.maxTemp) + '°C / ' + safeToFixedF(windowAnalysis.maxTemp) + '°F</p>' : '') +
    (windowAnalysis.maxHour != null ? '<p><b>Peak hour:</b> ' + ('0' + windowAnalysis.maxHour).slice(-2) + ':00</p>' : '') +
    (windowAnalysis.trend != null ? '<p><b>Heat trend across window:</b> ' + (windowAnalysis.trend >= 0 ? 'temperature increasing' : 'temperature decreasing') + ' by ' + safeDeltaF(Math.abs(windowAnalysis.trend)) + '°F</p>' : '')
  });

  // 10. Alerts
  if (alerts.length > 0) {
    sections.push({
      title: 'Active Alerts',
      body: '<table><thead><tr><th>Severity</th><th>Type</th><th>Location</th><th>Detail</th><th>Recommended Action</th></tr></thead><tbody>' +
      alerts.slice(0, 12).map(function(a) {
        var bg = a.severity === 'Critical' ? '#ffdad6' : a.severity === 'High' ? '#fde293' : '#e3e2e7';
        var fc = a.severity === 'Critical' ? '#ba1a1a' : a.severity === 'High' ? '#7a5a00' : '#7a5a00';
        return '<tr><td><span class="badge" style="background:' + bg + ';color:' + fc + '">' + esc(a.severity) + '</span></td><td>' + (a.type != null && a.type !== undefined ? esc(a.type) : '—') + '</td><td>' + (a.location != null && a.location !== undefined ? esc(a.location) : '—') + '</td><td>' + (a.description != null && a.description !== undefined ? esc(a.description) : '—') + '</td><td>' + (a.recommendation != null && a.recommendation !== undefined ? esc(a.recommendation) : '—') + '</td></tr>';
      }).join('') + '</tbody></table>'
    });
  }

  // 11. Asset/Route Exposure
  if (assets.length > 0) {
    var byBand = {};
    assets.forEach(function(a) {
      var b = a.risk && a.risk.band != null ? String(a.risk.band) : 'Unclassified';
      byBand[b] = (byBand[b] || 0) + 1;
    });
    var hottest = assets.filter(function(a) { return a.tempC != null; })
      .sort(function(x, y) { return Number(y.tempC) - Number(x.tempC); })
      .slice(0, 10);
    sections.push({
      title: 'Asset Exposure',
      body: '<p><b>Monitored assets:</b> ' + assets.length + '</p>' +
      '<p><b>Risk distribution:</b> ' + Object.keys(byBand).map(function(b) { return esc(b) + ': ' + byBand[b]; }).join(' &nbsp;•&nbsp; ') + '</p>' +
      (hottest.length > 0
        ? '<h3>Highest-exposure assets</h3><table><thead><tr><th>Asset</th><th>Category</th><th>Temp °C</th><th>Temp °F</th><th>Risk band</th></tr></thead><tbody>' +
          hottest.map(function(a) {
            return '<tr><td>' + esc(safeDisplay(a.name)) + '</td><td>' + esc(safeDisplay(a.category != null ? a.category : a.type)) + '</td><td>' +
              safeToFixed(a.tempC) + '</td><td>' + (a.tempF != null ? safeToFixed(a.tempF) : safeToFixedF(a.tempC)) + '</td><td>' +
              esc(a.risk && a.risk.band != null ? a.risk.band : '—') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p><i>Unavailable — no per-asset temperatures in the supplied context.</i></p>') +
      (exp && exp.level != null
        ? '<p><b>Area exposure level:</b> ' + esc(safeDisplay(exp.level)) + (exp.score != null ? ' (score ' + safeRound(exp.score) + ')' : '') + '</p>' +
          (Array.isArray(exp.drivers) && exp.drivers.length ? '<p><b>Drivers:</b> ' + exp.drivers.map(function(d) { return esc(String(d)); }).join('; ') + '</p>' : '')
        : '')
    });
  }

  // 12. Key Findings
  var findings = [];
  if (reportDataset.thermal.surfaceTemp != null) findings.push('Area mean surface temperature is ' + safeToFixed(reportDataset.thermal.surfaceTemp) + '°C / ' + safeToFixedF(reportDataset.thermal.surfaceTemp) + '°F across ' + (stats.n != null ? stats.n + ' grid cells' : 'the area of interest') + '.');
  if (windowAnalysis.meanTemp != null) findings.push('Mean temperature of ' + safeToFixed(windowAnalysis.meanTemp) + '°C / ' + safeToFixedF(windowAnalysis.meanTemp) + '°F was observed during the analysis window.');
  if (windowAnalysis.maxTemp != null) findings.push('Maximum temperature of ' + safeToFixedF(windowAnalysis.maxTemp) + '°F was recorded' + (windowAnalysis.maxHour != null ? ' at ' + ('0' + windowAnalysis.maxHour).slice(-2) + ':00' : '') + '.');
  if (suitability.classification !== '—') findings.push(esc(suitability.classification.toLowerCase()) + ' conditions were identified — ' + esc(suitability.period) + '.');
  if (windowAnalysis.hoursAboveThreshold != null) findings.push(windowAnalysis.hoursAboveThreshold + ' hour' + (windowAnalysis.hoursAboveThreshold !== 1 ? 's' : '') + ' exceeded the 90°F threshold.');
  if (alerts.length > 0) findings.push(alerts.length + ' active alert' + (alerts.length !== 1 ? 's' : '') + ' apply to this area.');
  if (assets.length > 0) findings.push(assets.length + ' monitored asset' + (assets.length !== 1 ? 's' : '') + ' fall within the area of interest.');
  sections.push({
    title: 'Key Findings',
    body: findings.length > 0
      ? findings.map(function(f) { return '<p>• ' + f + '</p>'; }).join('')
      : '<p><i>Insufficient data — no findings could be derived from the supplied context.</i></p>'
  });

  // 13. Recommendations
  if (recs.length > 0) {
    sections.push({
      title: 'Recommendations',
      body: '<ul class="recs">' + recs.map(function(r) { return '<li><b>' + (r.priority != null && r.priority !== undefined ? r.priority : '—') + '</b> — ' + (r.title != null && r.title !== undefined ? r.title : '—') + ': ' + (r.detail != null && r.detail !== undefined ? r.detail : '—') + '</li>'; }).join('') + '</ul>'
    });
  }

  // 14. Methodology
  sections.push({
    title: 'Methodology',
    body: '<p>This report was generated using the THERMA data-first report pipeline.</p><p>All metrics are calculated from actual available data. Derived values record their source and method.</p><p>Missing data is explicitly classified and reported in the Data Quality section.</p><p>The analysis window was selected based on available hourly data: ' + windowLabel + '.</p>'
  });

  // 15. Limitations
  sections.push({
    title: 'Limitations',
    body: '<p>Report generated from available THERMA context data. Missing metrics are classified as AVAILABLE, DERIVABLE, OPTIONAL, or MISSING.</p><p>Derived values are calculated from source data where all required inputs exist; otherwise they are marked unavailable.</p><p>No values are fabricated or invented. All data provenance is recorded in the Data Quality and Derived Metrics sections.</p>'
  });

  var reportDate = now.toLocaleString('en-US');

  var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>THERMA Report — ' + esc(context && context.location ? context.location.display : '—') + '</title><style>body{font-family:Inter,-apple-system,sans-serif;background:#faf8fe;color:#1a1b1f;margin:0;padding:32px;}.sheet{max-width:920px;margin:0 auto;background:#fff;border-radius:24px;padding:40px;box-shadow:0 8px 32px rgba(0,0,0,.05);}h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em;}.sub{color:#444748;font-size:14px;margin-bottom:24px;}.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;}.card{background:#f4f3f8;border-radius:16px;padding:14px;}.k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#444748;margin-bottom:6px;}.v{font-size:18px;font-weight:700;}.s{font-size:12px;color:#444748;margin-top:4px;}h2{font-size:18px;margin:28px 0 12px;}table{width:100%;border-collapse:collapse;font-size:13px;}th{text-align:left;font-size:11px;text-transform:uppercase;color:#444748;padding:6px 8px;border-bottom:1px solid #e3e2e7;}td{padding:8px;border-bottom:1px solid #efedf3;vertical-align:top;}.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:600;font-size:11px;}.recs li{margin-bottom:8px;}.chart-container{margin:20px 0;page-break-inside:avoid;}.chart-container h3{font-size:13px;margin:0 0 8px;color:#1e293b;}.foot{margin-top:32px;font-size:11px;color:#747878;border-top:1px solid #e3e2e7;padding-top:12px;}</style></head><body><div class="sheet"><h1>THERMA — Heat Intelligence Report</h1><div class="sub">' + esc(context && context.location ? context.location.display : '—') + ' ' + (loc.county != null ? '(' + esc(loc.county) + ')' : '') + (loc.region != null ? ', ' + esc(loc.region) : '') + ' &nbsp;•&nbsp; Generated ' + reportDate + ' &nbsp;•&nbsp; ' + sourceLabel + '</div>' + sections.map(function(s) { return '<h2>' + (s.title != null && s.title !== undefined ? s.title : '—') + '</h2>' + s.body; }).join('') + '<div class="foot">THERMA • AI-Powered Heat Intelligence • Florida Focus • Report ' + id + ' — generated ' + now.toLocaleString('en-US') + '. Estimates and analysis are derived from available data sources; missing data is explicitly classified. ' + (windowAnalysis.sampleCount != null ? 'Analysis based on ' + windowAnalysis.sampleCount + ' hourly observation' + (windowAnalysis.sampleCount !== 1 ? 's' : '') + '.' : '') + '</div></div></body></html>';

  logging('BUILD_COMPLETE', { id: id, htmlLength: html.length });
  reports.set(id, { html: html, meta: { id: id, location: safeDisplay(loc.display), createdAt: now.toISOString(), source: reportDataset.metadata.source, sections: sections.map(function(s) { return s.title != null && s.title !== undefined ? s.title : '—'; }), datasetSummary: { available: availableCount, derived: audit.derivable.length, unavailable: unavailableCount, window: windowLabel, sampleCount: windowAnalysis.sampleCount } } });
  logging('ARTIFACT_STORED', id);
  return { id: id, meta: { id: id, location: safeDisplay(loc.display), createdAt: now.toISOString(), source: reportDataset.metadata.source, sections: sections.map(function(s) { return s.title != null && s.title !== undefined ? s.title : '—'; }), datasetSummary: { available: availableCount, derived: audit.derivable.length, unavailable: unavailableCount, window: windowLabel, sampleCount: windowAnalysis.sampleCount } }, html };
}

function getReport(id) {
  var entry = reports.get(id);
  return entry || null;
}

module.exports = { buildReport, getReport, lastStage };