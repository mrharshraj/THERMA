const { credentials } = require('../config');

const BASE_URL = process.env.FORTYGUARD_BASE_URL || 'https://api.fortyguard.com';
const DEFAULT_TIMEOUT_MS = 60000;

class FortyGuardError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.name = 'FortyGuardError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function apiFetch(method, path, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const key = credentials.getFortyguardKey();
  if (!key) throw new FortyGuardError('FortyGuard credential is not available.', 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'api-key': key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new FortyGuardError('FortyGuard request timed out.', 504);
    }
    throw new FortyGuardError('Could not reach FortyGuard API. ' + err.message, 502);
  }
  clearTimeout(timer);

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }

  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `HTTP ${res.status}`;
    throw new FortyGuardError(String(msg), res.status, body);
  }
  return body;
}

function extractActivityId(body) {
  if (body && body.error) {
    throw new FortyGuardError(body.message || 'FortyGuard request failed', 400, body);
  }
  const id = body && body.data && body.data.activity_id;
  if (!id) {
    throw new FortyGuardError('FortyGuard did not return an activity_id.', 502, body);
  }
  return id;
}

async function getStatus(activityId, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const body = await apiFetch('GET', `/v1/status/${encodeURIComponent(activityId)}`, null, timeoutMs);
  if (body.error) {
    throw new FortyGuardError(body.message || 'Status lookup failed', 400, body);
  }
  return body.data;
}

async function waitForResult(activityId, { pollIntervalMs = 3000, timeoutMs = 180000, onTick } = {}) {
  const deadline = Date.now() + timeoutMs;
  let data = null;
  while (true) {
    try {
      data = await getStatus(activityId);
    } catch (err) {
      if (err.statusCode === 404) {
        // Activity not yet queryable (eventual consistency). Keep polling.
        data = { status: 'pending' };
      } else {
        throw err;
      }
    }
    const status = String(data.status || 'pending').toLowerCase();
    if (onTick) onTick(status, data);
    if (status === 'completed' || status === 'succeeded') {
      return { activityId, status, result: data.result || {} };
    }
    if (status === 'failed' || status === 'error') {
      throw new FortyGuardError(data.message || `Task ${activityId} failed.`, 502, data);
    }
    if (Date.now() >= deadline) {
      throw new FortyGuardError(`Task ${activityId} still "${status}" after ${Math.round(timeoutMs / 1000)}s.`, 504);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

async function submitAndWait(endpoint, payload, options, timeoutMs = 180000) {
  const body = await apiFetch('POST', endpoint, payload);
  const activityId = extractActivityId(body);
  return waitForResult(activityId, { timeoutMs, ...options });
}

async function submitOnly(endpoint, payload) {
  const body = await apiFetch('POST', endpoint, payload);
  return { activityId: extractActivityId(body) };
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------------

function createHeatmap({
  polygon,
  startDate = todayStr(-1),
  endDate = null,
  startTime = null,
  endTime = null,
  filterType = 3,
  granularity = 100,
  analyticType = 'tcm',
  threshold = 30,
  direction = 'above',
  wait = true,
  options = {},
}) {
  const dateTime = { start_date: startDate, filter_type: filterType };
  if (startTime) dateTime.start_time = startTime;
  if (endTime) dateTime.end_time = endTime;
  if (endDate) dateTime.end_date = endDate;

  const payload = {
    polygon_aoi: polygon,
    date_time: dateTime,
    granularity,
    analytic_type: analyticType,
  };
  if (analyticType === 'exceedance' || analyticType === 'persistence') {
    payload.threshold = threshold;
    payload.direction = direction;
  }
  if (!wait) return submitOnly('/v1/heatmap', payload);
  return submitAndWait('/v1/heatmap', payload, options);
}

function environmentalParameters({
  latitude,
  longitude,
  temperature,
  startDate = todayStr(-1),
  endDate = null,
  startTime = null,
  endTime = null,
  filterType = 3,
  analysis = null,
  wait = true,
  options = {},
}) {
  const dateTime = { start_date: startDate, filter_type: filterType };
  if (startTime) dateTime.start_time = startTime;
  if (endTime) dateTime.end_time = endTime;
  if (endDate) dateTime.end_date = endDate;

  const payload = {
    latitude,
    longitude,
    temperature,
    date_time: dateTime,
  };
  if (analysis) payload.analysis = analysis;
  if (!wait) return submitOnly('/v1/env_params', payload);
  return submitAndWait('/v1/env_params', payload, options);
}

function satelliteSegmentation({
  latitude,
  longitude,
  startDate = todayStr(-60),
  filterType = 3,
  granularity = 100,
  wait = true,
  options = {},
}) {
  const payload = {
    sat: { latitude, longitude },
    date_time: { start_date: startDate, filter_type: filterType },
    granularity,
  };
  if (!wait) return submitOnly('/v1/satellite', payload);
  return submitAndWait('/v1/satellite', payload, options);
}

function streetViewSegmentation({
  latitude,
  longitude,
  verticalAngle = 0,
  horizontalAngle = 0,
  backView = false,
  wait = true,
  options = {},
}) {
  const payload = {
    latitude,
    longitude,
    vertical_angle: verticalAngle,
    horizontal_angle: horizontalAngle,
    back_view: backView,
  };
  if (!wait) return submitOnly('/v1/streetview', payload);
  return submitAndWait('/v1/streetview', payload, options);
}

async function heatIntelligence({
  latitude,
  longitude,
  temperature,
  date = todayStr(-1),
  analysis = ['environmental'],
}) {
  const payload = { latitude, longitude, temperature, date, analysis };
  const body = await apiFetch('POST', '/v1/heat_intelligence', payload);
  const activityId = extractActivityId(body);
  const { result } = await waitForResult(activityId, { pollIntervalMs: 5000, timeoutMs: 300000 });
  const link = result && result.download_link;
  if (!link) throw new FortyGuardError('Heat intelligence report completed without a download link.', 502, result);
  return { activityId, downloadLink: link, meta: result };
}

async function fetchUsage() {
  const key = credentials.getFortyguardKey();
  if (!key) throw new FortyGuardError('FortyGuard credential is not available.', 503);
  const body = await apiFetch('POST', '/v1/system/fetch-api-key-usage', { api_key: key });
  return body;
}

module.exports = {
  FortyGuardError,
  createHeatmap,
  environmentalParameters,
  satelliteSegmentation,
  streetViewSegmentation,
  heatIntelligence,
  fetchUsage,
  todayStr,
};