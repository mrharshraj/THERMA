// Hash router with lazy-loaded screen modules.

export const ROUTES = {
  overview:   { title: 'Overview',                 icon: 'dashboard',          label: 'Overview',              group: 'main',        file: 'overview' },
  heat:       { title: 'Heat Intelligence',        icon: 'thermostat',         label: 'Heat Intelligence',  group: 'main',        file: 'heat' },
  coolroute:  { title: 'CoolRoute',                icon: 'route',               label: 'CoolRoute',            group: 'main',        file: 'coolroute' },
  explorer:   { title: 'Map Explorer',             icon: 'map',                 label: 'Map Explorer',         group: 'main',        file: 'explorer' },
  environment:{ title: 'Environmental Intelligence', icon: 'eco',                label: 'Environment',          group: 'main',        file: 'environment' },
  portfolio:  { title: 'Portfolio Monitoring',     icon: 'domain',              label: 'Portfolio',            group: 'intelligence', file: 'portfolio' },
  urban:      { title: 'Urban & Property',         icon: 'location_city',      label: 'Urban & Property',     group: 'intelligence', file: 'urban' },
  facilities: { title: 'Facility Analysis',        icon: 'factory',             label: 'Facilities',           group: 'intelligence', file: 'facilities' },
  logistics:  { title: 'Logistics Operations',     icon: 'local_shipping',      label: 'Logistics',            group: 'intelligence', file: 'logistics' },
  utilities:  { title: 'Infrastructure & Utilities', icon: 'bolt',              label: 'Infrastructure',       group: 'intelligence', file: 'utilities' },
  risk:       { title: 'Risk & Insurance',         icon: 'security',           label: 'Risk & Insurance',     group: 'intelligence', file: 'risk' },
  scenarios:  { title: 'Scenario Simulation',      icon: 'science',             label: 'Scenarios',            group: 'operate',     file: 'scenarios' },
  alerts:     { title: 'Active Alerts',            icon: 'notification_important', label: 'Alerts',            group: 'operate',     file: 'alerts' },
  reports:    { title: 'Reports Library',          icon: 'description',         label: 'Reports',              group: 'operate',     file: 'reports' },
  workspace:  { title: 'Decision Workspace',       icon: 'psychology',          label: 'Decision Workspace',   group: 'operate',     file: 'workspace' },
  zoe:        { title: 'Zoe Operator Workspace',   icon: 'smart_toy',           label: 'Zoe Workspace',        group: 'system',      file: 'zoespace' },
  search:     { title: 'Global Command Search',    icon: 'search',              label: 'Global Search',        group: 'system',      file: 'search' },
  location:   { title: 'Location Detail',          icon: 'location_on',         label: 'Location Detail',      group: 'system',      file: 'location' },
  settings:   { title: 'Platform Settings',        icon: 'settings',            label: 'Settings',             group: 'system',      file: 'settings' },
  therma:     { title: 'THERMA Intelligence',      icon: 'info',               label: 'Therma Intelligence',  group: 'system',      file: 'therma' },
  // Onboarding-only route (Splash → Role Selector → Overview). It is not part
  // of any sidebar category; Settings → Change Role is the way back to it.
  role:       { title: 'Role Selector',            icon: 'account_circle',     label: 'Role',                  group: 'system',      file: 'role' },
};

const GROUP_LABELS = {
  main: 'Command',
  intelligence: 'Intelligence',
  operate: 'Operations',
  system: 'System',
};

let currentRoute = null;
let changeHandlers = [];

export function parseHash() {
  const raw = (window.location.hash || '#/overview').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  const name = ROUTES[segs[0]] ? segs[0] : 'overview';
  const param = segs.slice(1).join('/') || null;
  const query = {};
  new URLSearchParams(queryPart || '').forEach((v, k) => { query[k] = v; });
  return { name, param, query };
}

export function navigate(name, { param = null, query = {}, replace = false } = {}) {
  if (!ROUTES[name]) name = 'overview';
  let h = `#/${name}`;
  if (param != null && param !== '') h += `/${param}`;
  const qs = new URLSearchParams(query).toString();
  if (qs) h += `?${qs}`;
  if (replace) window.location.replace(h);
  else if (window.location.hash === h) handleChange();
  else window.location.hash = h;
}

export function current() {
  return currentRoute;
}

export function routeMeta(name) {
  return ROUTES[name] || null;
}

function handleChange() {
  const parsed = parseHash();
  const meta = ROUTES[parsed.name];
  currentRoute = { ...parsed, meta };
  for (const fn of changeHandlers) {
    try { fn(currentRoute); } catch (e) { console.error(e); }
  }
}

async function loadScreen(file) {
  const mod = await import(`/screens/${file}.js`);
  return mod.default;
}

// ---------------------------------------------------------------------------
// Render lifecycle. ONE active screen at a time, guaranteed:
//   - Every resolve() takes a monotonically increasing sequence number and
//     re-checks it after each await. A newer navigation invalidates older
//     in-flight renders, so two screens can never interleave into the host
//     (the historical source of duplicated screens/maps/controls).
//   - Screens may register cleanup callbacks (onScreenCleanup) — window/store
//     listeners etc. They run right before the next screen mounts.
//   - Screens re-render themselves on data refresh via rerenderScreen(), which
//     re-validates host attachment AFTER its awaits — a refresh never mounts a
//     second copy of the screen.
// ---------------------------------------------------------------------------
let renderSeq = 0;
let screenCleanups = [];

export function onScreenCleanup(fn) {
  if (typeof fn === 'function') screenCleanups.push(fn);
}

// Register a global listener that lives exactly as long as the current screen.
// The router removes it when the next screen mounts (no accumulating
// therma:context / therma:grid / action listeners across refreshes).
export function screenEvent(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  onScreenCleanup(() => target.removeEventListener(type, fn, opts));
}

function runScreenCleanups() {
  const fns = screenCleanups;
  screenCleanups = [];
  for (const fn of fns) {
    try { fn(); } catch (e) { console.error('[router] cleanup failed', e); }
  }
}

// Data-refresh re-render for the CURRENT screen only. Safe against navigation:
// attachment is re-checked after the dynamic import resolves, so a late
// refresh can never paint a second screen into a host that has been replaced.
export async function rerenderScreen(file, host) {
  const seq = renderSeq;
  const mod = await import(`/screens/${file}.js`);
  if (seq !== renderSeq) return;                 // navigated away mid-refresh
  if (!host || !document.body.contains(host)) return;  // host already replaced
  host.innerHTML = '';
  await mod.default.render(host, {});
}

// ---------------------------------------------------------------------------
// Shell selection. Onboarding routes (#/role) render into #onboarding-host —
// OUTSIDE the application shell — so no sidebar/topbar/mobile-nav exists on
// them. Every other route mounts the application shell (#app) with the screen
// scaffold. This is a real host switch: the unused shell is detached via the
// `hidden` attribute, not CSS-patched per piece.
// ---------------------------------------------------------------------------
function activateShell(route) {
  const app = document.getElementById('app');
  const onboarding = document.getElementById('onboarding-host');
  const fab = document.getElementById('zoe-fab');
  const isOnboarding = route.name === 'role';
  if (isOnboarding) {
    app.setAttribute('hidden', '');
    onboarding.removeAttribute('hidden');
    if (fab) fab.setAttribute('hidden', '');
  } else {
    app.removeAttribute('hidden');
    onboarding.setAttribute('hidden', '');
    onboarding.innerHTML = '';
    if (fab) fab.removeAttribute('hidden');
  }
  return isOnboarding ? onboarding : document.getElementById('screen');
}

// The scaffold is ALWAYS a child div of the active shell host (#screen or
// #onboarding-host) — never the host itself. It carries data-scaffold="1" so
// resolve() can distinguish a rerenderScreen() callback (which passes the
// scaffold back in) from a fresh navigation (which passes the shell host).
// Mutating the host's own className would break the shell layout and poison
// that distinction.
function mountScaffold(shellHost) {
  let scaffold = shellHost.firstElementChild;
  if (!scaffold || scaffold.dataset.scaffold !== '1') {
    shellHost.innerHTML = '';
    scaffold = document.createElement('div');
    scaffold.dataset.scaffold = '1';
    shellHost.appendChild(scaffold);
  }
  return scaffold;
}

export async function resolve(route, container) {
  try {
    const meta = ROUTES[route.name];
    const seq = ++renderSeq;          // this navigation owns the host from here on

    // Tear down the previous screen's listeners BEFORE mounting the next one.
    runScreenCleanups();

    // rerenderScreen() hands the existing scaffold straight back to us; fresh
    // navigations go through the shell switch and get a scaffold mounted.
    const isRerender = !!(container && container.dataset && container.dataset.scaffold === '1');
    const host = isRerender ? container : mountScaffold(activateShell(route));
    await resolveInner(route, meta, seq, host);
  } catch (e) {
    console.error('[SHELL] resolve CRASHED for', route && route.name, e);
  }
}

async function resolveInner(route, meta, seq, host) {

  host.innerHTML = '';
  // Every screen renders inside a scaffold host that owns padding + layout:
  // .screen-scroll (document-flow dashboards) or .screen-fixed (viewport-locked
  // workspace, internal panel scrolls at lg+). Onboarding owns the full
  // viewport with its own padding — no app-shell scaffold.
  host.className = route.name === 'role'
    ? 'w-full min-h-screen px-md md:px-lg py-lg'
    : 'screen-scroll';
  const skeleton = document.createElement('div');
  skeleton.className = 'p-md fade-in';
  skeleton.innerHTML = `
    <div class="skeleton h-8 w-64 mb-md"></div>
    <div class="grid gap-md" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
      ${'<div class="skeleton h-40"></div>'.repeat(4)}
    </div>`;
  host.appendChild(skeleton);
  let Screen;
  try {
    Screen = await loadScreen(meta.file);
  } catch (err) {
    if (seq !== renderSeq) return;
    host.innerHTML = '';
    host.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-sm p-xl text-center fade-in">
        <span class="material-symbols-outlined text-error" style="font-size:44px;">error</span>
        <h2 class="text-headline-md font-semibold">Screen unavailable</h2>
        <p class="text-on-surface-variant max-w-md">We couldn't load this part of THERMA. Try reloading the application.</p>
        <button class="squishy-btn bg-primary text-on-primary px-md py-xs rounded-full font-semibold" onclick="window.location.reload()">Reload</button>
      </div>`;
    console.error(err);
    return;
  }
  if (seq !== renderSeq) return;    // a newer navigation won while loading
  host.innerHTML = '';
  host.className = Screen.layout === 'fixed' ? 'screen-fixed' : 'screen-scroll';
  if (route.name === 'role') host.className = 'w-full min-h-screen px-md md:px-lg py-lg';
  await Screen.render(host, route);
}

export function start(handler) {
  changeHandlers.push(handler);
  window.addEventListener('hashchange', () => {
    handleChange();
  });
  if (!window.location.hash) window.location.hash = '#/overview';
  handleChange();
}

export { GROUP_LABELS };
