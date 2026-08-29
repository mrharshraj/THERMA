// THERMA global reactive store (ported from public/app/store.js)

const initial = {
  booted: false,
  health: null,
  fgStatus: null,
  demoMode: null,
  theme: "system",

  place: null,
  context: null,
  contextLoading: false,
  contextError: null,

  gridLayer: "temperature",
  layerCache: {},
  layerLoading: false,

  environment: null,
  envLoading: false,
  envError: null,

  routes: null,
  routesLoading: false,
  routesError: null,
  selectedRouteId: null,

  selectedAssetId: null,
  selectedAlertId: null,
  _routeQuery: {},

  sidebarCollapsed: false,
  zoeOpen: true,
  zoeHistory: [],

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

export function initStore() {
  try {
    const persisted = JSON.parse(localStorage.getItem("therma.state") || "{}");
    if (persisted.theme) state.theme = persisted.theme;
    if (persisted.demoMode !== undefined) state.demoMode = persisted.demoMode;
    if (persisted.sidebarCollapsed !== undefined) state.sidebarCollapsed = persisted.sidebarCollapsed;
    if (persisted.zoeOpen !== undefined) state.zoeOpen = persisted.zoeOpen;
  } catch {}
  
  subscribe((s, keys) => {
    if (keys.some(k => ["theme", "demoMode", "sidebarCollapsed", "zoeOpen"].includes(k))) {
      localStorage.setItem("therma.state", JSON.stringify({
        theme: s.theme,
        demoMode: s.demoMode,
        sidebarCollapsed: s.sidebarCollapsed,
        zoeOpen: s.zoeOpen
      }));
    }
  });
}

export function reset() {
  state = { ...initial };
}

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

// Reports stash (ported from public/app/zoe.js)
export function stashReport(meta) {
  try {
    const list = JSON.parse(sessionStorage.getItem("therma.reports") || "[]");
    list.unshift(meta);
    sessionStorage.setItem("therma.reports", JSON.stringify(list.slice(0, 25)));
  } catch {}
}

export function stashedReports() {
  try { return JSON.parse(sessionStorage.getItem("therma.reports") || "[]"); } catch { return []; }
}
