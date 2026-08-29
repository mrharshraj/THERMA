// THERMA API client. All FortyGuard/Gemini access goes through the backend.

import { getState, setState } from './store.js';

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0, detail = '', stage = '', requestId = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    // Set only by endpoints that ship development diagnostics (report
    // generation). Empty in production, where the backend sends neither.
    this.stage = stage;
    this.requestId = requestId;
  }
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Adds the explicit demo override only when the user forced a mode.
function applyDemo(params) {
  const dm = getState().demoMode;
  const out = { ...params };
  if (dm === true) out.demo = 1;
  else if (dm === false) out.demo = 0;
  return out;
}

async function request(path, { method = 'GET', params, body } = {}) {
  let res;
  try {
    res = await fetch(path + qs(params), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the THERMA backend.', { code: 'NETWORK', status: 0 });
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    const err = (data && data.error) || {};
    throw new ApiError(err.message || `Request failed (${res.status}).`, {
      code: err.code || 'HTTP_' + res.status,
      status: res.status,
      detail: err.detail || '',
      stage: err.stage || '',
      requestId: err.requestId || '',
    });
  }
  return data;
}

// ---------------- endpoints ----------------

export const getHealth = () => request('/api/health');
export const getFortyGuardStatus = () => request('/api/status/fortyguard');

export const geoSearch = (q) => request('/api/geo/search', { params: { q } });
export const geoPlaces = () => request('/api/geo/places');
export const geoReverse = (lat, lon) => request('/api/geo/reverse', { params: { lat, lon } });

export const getContext = (placeId) =>
  request('/api/context', { params: applyDemo({ place: placeId }) });

export const getContextGrid = (placeId, layer = 'temperature') =>
  request('/api/context/grid', { params: applyDemo({ place: placeId, layer }) });

export const getContextLayer = (placeId, layer) =>
  request('/api/context/layer', { params: applyDemo({ place: placeId, layer }) });

export const getEnvironment = (placeId, temperature, { refresh = false } = {}) =>
  request('/api/environment', { params: applyDemo({ place: placeId, temperature, refresh: refresh ? 1 : undefined }) });

export const getSatellite = (placeId) =>
  request('/api/satellite', { params: applyDemo({ place: placeId }) });

export const getStreetView = (placeId) =>
  request('/api/streetview', { params: applyDemo({ place: placeId }) });

export const postHeatIntelligence = (placeId, temperature) =>
  request('/api/heat-intelligence', { method: 'POST', body: { place: placeId, temperature } });

export const getRoutes = ({ fromId, toId, from, to, mode }) =>
  request('/api/routes', {
    params: applyDemo({
      fromId, toId,
      from: from ? `${from.lat},${from.lon}` : undefined,
      to: to ? `${to.lat},${to.lon}` : undefined,
      mode,
    }),
  });

export const postZoe = ({ message, context, history }) =>
  request('/api/zoe', { method: 'POST', body: { message, context, history } });

export const generateReport = (context) =>
  request('/api/reports/generate', { method: 'POST', body: { context } });

export const reportUrl = (id) => `/api/reports/${encodeURIComponent(id)}`;

// ---------------- context loading ----------------
// Stale-request protection: every loader captures the current sequence number
// and only commits to the store if it is still the LATEST request. A slow
// response for a previously selected location can never overwrite the data
// for the location the user switched to in the meantime (P11).
let ctxSeq = 0;
let layerSeq = 0;
let envSeq = 0;

export async function loadContextFor(placeIdOrPlace) {
  const id = typeof placeIdOrPlace === 'string' ? placeIdOrPlace : placeIdOrPlace.id;
  const seq = ++ctxSeq;
  setState({ contextLoading: true, contextError: null });
  try {
    const ctx = await getContext(id);
    if (seq !== ctxSeq) return ctx;   // superseded by a newer location request
    setState({
      context: ctx,
      place: ctx.location || getState().place,
      contextLoading: false,
      gridLayer: 'temperature',
      layerCache: {},
      selectedAssetId: null,
      selectedAlertId: null,
    });
    window.dispatchEvent(new CustomEvent('therma:context', { detail: ctx }));
    return ctx;
  } catch (err) {
    if (seq !== ctxSeq) throw err;
    setState({ contextLoading: false, contextError: err });
    throw err;
  }
}

export async function loadGridLayer(placeId, layer, { force = false } = {}) {
  const st = getState();
  const key = `${placeId}:${layer}`;
  if (!force && st.layerCache[key]) return st.layerCache[key];
  const seq = ++layerSeq;
  setState({ layerLoading: true });
  try {
    const payload = await getContextGrid(placeId, layer);
    if (seq !== layerSeq) return payload;   // a newer layer request superseded this one
    setState({
      layerCache: { ...getState().layerCache, [key]: payload },
      layerLoading: false,
    });
    window.dispatchEvent(new CustomEvent('therma:grid', { detail: payload }));
    return payload;
  } catch (err) {
    if (seq !== layerSeq) throw err;
    setState({ layerLoading: false });
    throw err;
  }
}

export async function loadEnvironmentFor(placeId, anchorTempC, { force = false } = {}) {
  const seq = ++envSeq;
  setState({ envLoading: true, envError: null });
  try {
    const env = await getEnvironment(placeId, anchorTempC, { refresh: force });
    if (seq !== envSeq) return env;
    setState({ environment: env, envLoading: false });
    return env;
  } catch (err) {
    if (seq !== envSeq) throw err;
    setState({ envLoading: false, envError: err });
    throw err;
  }
}
