// Application bootstrap: shell wiring, health checks, initial context, router.

import { getState, setState, subscribe } from './store.js';
import { getHealth, getFortyGuardStatus, loadContextFor, geoSearch } from './api.js';
import { initTheme } from './theme.js';
import { start as startRouter, navigate, ROUTES } from './router.js';
import { initShellNav, closeDrawer, markActive } from './sidebar.js';
import { initVizWorkspace, hide as vizHide } from './visuals.js';
import { openMobile as zoeOpenMobile, bindMobileZoe, toggle as zoeToggle } from './zoe.js';
import { el, icon, toast } from './widgets.js';
import { loadPersistedRole, getSelectedRole } from './roles.js';
import { loadPersistedDemoMode } from './placepick.js';

const $ = (id) => document.getElementById(id);

function splashProgress(pctv, label) {
  // Stitch drives the initialization bar by width (it starts at w-0), not transform.
  const bar = $('splash-bar');
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, pctv)) * 100)}%`;
  const status = $('splash-status');
  if (status && label) status.textContent = label;
}

async function boot() {
  initTheme();
  loadPersistedRole();
  loadPersistedDemoMode();
  initShellNav();
  initVizWorkspace();
  bindMobileZoe();

  splashProgress(0.25, 'Linking geospatial protocol…');

  // Health + FortyGuard status in parallel; never block boot on failure.
  const healthTask = getHealth()
    .then((h) => {
      setState({ health: h });
      return h;
    })
    .catch(() => null);
  const fgTask = getFortyGuardStatus()
    .then((s) => {
      setState({ fgStatus: s });
      return s;
    })
    .catch(() => null);

  const health = await healthTask;
  splashProgress(0.55, 'Calibrating thermal baselines…');

  // Default location: Downtown Miami.
  let place = null;
  try {
    const { geoPlaces } = await import('./api.js');
    const places = await geoPlaces();
    place = (places.results || []).find((p) => p.id === 'miami-downtown') || (places.results || [])[0] || null;
    setState({ place });
  } catch { /* handled below via context error */ }

  // Initial context load (server decides demo vs live by default).
  let ctxError = null;
  if (place) {
    try {
      splashProgress(0.8, 'Generating hyperlocal heat intelligence…');
      await Promise.race([
        loadContextFor(place.id),
        new Promise((r) => setTimeout(r, 30000)),
      ]);
    } catch (err) {
      ctxError = err;
    }
  }
  await fgTask;

  splashProgress(1, 'Entering command view…');

  // Router
  startRouter((route) => {
    vizHide();
    closeDrawer();
    setState({ _routeQuery: route.query || {} });
    document.title = `${ROUTES[route.name].title} · Therma`;
    // Nothing dispatched `therma:navigated`, so sidebar.js's listener never fired and
    // the active nav pill only refreshed when the context happened to reload. Mark
    // directly (order-independent) and still emit the event other modules listen for.
    markActive();
    window.dispatchEvent(new CustomEvent('therma:navigated', { detail: route }));
    const host = $('screen');
    import('./router.js').then((m) => m.resolve(route, host)).catch((e) => console.error('[router] resolve failed:', e));
  });

  // Onboarding gate: Splash → Role Selector → Overview. Only when no role is
  // persisted — returning users go straight into the app (never re-prompted).
  if (!getSelectedRole()) navigate('role', { replace: true });

  // Global search modal
  bindSearch();

  // Shell chrome: Stitch topbar alerts button + unread dot, and the Zoe launcher.
  // (No theme toggles — THERMA is dark-only.)
  bindTopbar();

  // Zoe mobile entry: floating button (mobile only — desktop uses the topbar row).
  // Carries #zoe-fab so the onboarding shell can detach it with the app shell.
  const zoeFab = el('button', {
    id: 'zoe-fab',
    class: 'md:hidden fixed bottom-24 right-4 z-40 rounded-full bg-primary text-on-primary shadow-xl shadow-primary/20 flex items-center justify-center squishy-btn',
    style: { width: '52px', height: '52px' },
    'aria-label': 'Open Zoe',
    onclick: () => zoeOpenMobile(),
  }, icon('smart_toy', 'text-[24px]', false));
  document.body.appendChild(zoeFab);

  // Remove splash once the first screen has rendered. Plain timeout —
  // requestAnimationFrame never fires in background tabs and left the splash
  // pinned over a fully-booted app.
  setTimeout(() => {
    const splash = $('splash');
    if (!splash) return;
    splash.style.transition = 'opacity 450ms ease';
    splash.style.opacity = '0';
    $('app').classList.remove('opacity-0');
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 480);
    setState({ booted: true });
    if (ctxError) toast('Live heat intelligence unavailable — showing recovery options.', 'warn');
    window.dispatchEvent(new Event('resize'));
  }, 350);

  // Debug handle (no secrets exposed).
  window.__THERMA = { getState, navigate };
}

// ---------------- Stitch topbar ----------------

function bindTopbar() {
  const alertsBtn = $('topbar-alerts-btn');
  if (alertsBtn) alertsBtn.addEventListener('click', () => navigate('alerts'));

  const zoeBtn = $('topbar-zoe-btn');
  if (zoeBtn) zoeBtn.addEventListener('click', () => zoeToggle());

  // Unread dot mirrors the alert count the sidebar badge already uses.
  const syncDot = () => {
    const dot = $('topbar-alert-dot');
    if (!dot) return;
    const ctx = getState().context;
    dot.classList.toggle('hidden', !(ctx && ctx.alerts && ctx.alerts.length));
  };
  syncDot();
  subscribe((state, keys) => { if (keys.includes('context')) syncDot(); });
}

// ---------------- global search ----------------

let searchTimer = null;

function bindSearch() {
  const modal = $('search-modal');
  const input = $('search-input');
  const results = $('search-results');

  const openModal = () => {
    modal.classList.remove('hidden');
    input.value = '';
    renderSearchDefault(results);
    setTimeout(() => input.focus(), 60);
    setState({ searchOpen: true });
  };
  const closeModal = () => {
    modal.classList.add('hidden');
    setState({ searchOpen: false });
  };

  document.querySelectorAll('[data-search-close]').forEach((x) => x.addEventListener('click', closeModal));
  // Every search entry point opts in with [data-search-open]: the mobile topbar
  // icon and the desktop topbar search pill.
  document.querySelectorAll('[data-search-open]').forEach((x) => x.addEventListener('click', openModal));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      modal.classList.contains('hidden') ? openModal() : closeModal();
    }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) { renderSearchDefault(results); return; }
    searchTimer = setTimeout(async () => {
      results.innerHTML = '';
      results.appendChild(el('div', { class: 'p-sm flex items-center gap-sm text-on-surface-variant' },
        el('div', { class: 'spinner' }), el('span', { class: 'text-[12px] font-semibold' }, 'Searching Florida locations…')));
      try {
        const { results: locs } = await geoSearch(q);
        results.innerHTML = '';
        const screens = Object.entries(ROUTES).filter(([k, r]) =>
          r.title.toLowerCase().includes(q.toLowerCase()) || r.label.toLowerCase().includes(q.toLowerCase()));
        if (screens.length) {
          results.appendChild(el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1' }, 'Screens'));
          for (const [key, r] of screens.slice(0, 5)) {
            results.appendChild(searchRow(icon(r.icon, 'text-[18px]', false), r.title, 'Navigate',
              () => { closeModal(); navigate(key); }));
          }
        }
        results.appendChild(el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1' }, 'Locations'));
        if (!locs.length) {
          results.appendChild(el('p', { class: 'px-3 py-3 text-[12.5px] text-on-surface-variant/80' },
            `No Florida location matched “${q}”.`));
        }
        for (const p of locs) {
          results.appendChild(searchRow(
            icon(p.external ? 'travel_explore' : 'location_on', 'text-[18px]', false),
            p.display,
            `${Number(p.lat).toFixed(3)}, ${Number(p.lon).toFixed(3)}${p.type ? ' · ' + p.type : ''}`,
            async () => {
              closeModal();
              const { loadContextFor } = await import('./api.js');
              try {
                await loadContextFor(p.id);
                navigate('location', { param: p.id });
                toast(`Location set: ${p.display}`, 'success');
              } catch (err) {
                toast(err.message || 'Could not load that location.', 'error');
              }
            }));
        }
      } catch {
        results.innerHTML = '';
        results.appendChild(el('p', { class: 'px-3 py-3 text-[12.5px] text-error' }, 'Search is unavailable right now.'));
      }
    }, 280);
  });
}

function searchRow(icNode, title, sub, onClick) {
  return el('button', {
    class: 'w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-container/80 text-left transition-colors',
    onclick: onClick,
  },
  el('span', { class: 'w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0' }, icNode),
  el('span', { class: 'min-w-0 flex-1' },
    el('span', { class: 'block text-[13.5px] font-bold truncate' }, title),
    sub ? el('span', { class: 'block text-[11px] text-on-surface-variant/80 truncate' }, sub) : null),
  icon('north_east', 'text-[14px] opacity-50', false));
}

function renderSearchDefault(host) {
  host.innerHTML = '';
  host.appendChild(el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1' }, 'Quick navigation'));
  ['overview', 'heat', 'coolroute', 'environment', 'alerts', 'workspace'].forEach((k) => {
    const r = ROUTES[k];
    host.appendChild(searchRow(icon(r.icon, 'text-[18px]', false), r.title, null, () => {
      $('search-modal').classList.add('hidden');
      navigate(k);
    }));
  });
  host.appendChild(el('p', { class: 'px-2 pt-3 pb-2 text-[11px] text-on-surface-variant/70' },
    'Type to search Miami-Dade and Florida locations — or press Esc to close.'));
}

boot().catch((err) => {
  console.error(err);
  const status = $('splash-status');
  if (status) status.textContent = 'Startup problem — please reload.';
});
