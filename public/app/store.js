// THERMA global reactive store.

const initial = {
  booted: false,
  health: null,            // /health response
  fgStatus: null,          // /status/fortyguard response
  demoMode: null,          // null = follow backend default; true/false forces query param
  theme: 'system',

  // Global selection
  place: null,             // selected place object {id,name,display,lat,lon,...}
  context: null,           // /context response (slim)
  contextLoading: false,
  contextError: null,

  gridLayer: 'temperature',
  layerCache: {},          // `${placeId}:${layer}` -> /context/grid payload
  layerLoading: false,

  environment: null,
  envLoading: false,
  envError: null,

  routes: null,            // /routes response
  routesLoading: false,
  routesError: null,
  selectedRouteId: null,

  selectedAssetId: null,
  selectedAlertId: null,
  _routeQuery: {},

  sidebarCollapsed: false,
  // Zoe is now an on-demand overlay (Stitch's shell has no permanent right rail),
  // and #zoe-panel ships with `hidden`. Starting this at true desynced state from
  // the DOM, so the first toggle() closed an already-hidden panel.
  zoeOpen: false,
  zoeHistory: [],          // [{role:'user'|'model', content, meta}]

  searchOpen: false,
};

let state = { ...initial };
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  const changed = {};
  for (const k of Object.keys(patch)) {
    changed[k] = true;
    state[k] = patch[k];
  }
  for (const fn of listeners) {
    try { fn(state, Object.keys(changed)); } catch (e) { console.error(e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  state = { ...initial };
}

// ---- derived helpers ----

export function isDemoActive(respSource) {
  if (state.demoMode === true) return true;
  if (respSource && respSource.demo != null) return !!respSource.demo;
  return !!(state.health && state.health.demoDefault);
}

export function currentPlace() {
  return state.place || null;
}

export function contextHeatmap() {
  return state.context ? state.context.heatmap : null;
}

export function contextExposure() {
  return state.context ? state.context.exposure : null;
}

export function contextEnv() {
  return state.context ? state.context.environment : null;
}

export function contextAlerts() {
  return state.context ? state.context.alerts || [] : [];
}

export function contextAssets() {
  return state.context ? state.context.assets || [] : [];
}
