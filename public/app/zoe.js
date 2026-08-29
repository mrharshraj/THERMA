// Zoe — THERMA application operator. Desktop right rail + mobile sheet.
// Executes only backend-validated actions; renders approved visualizations.

import { getState, setState } from './store.js';
import { postZoe, loadContextFor, loadGridLayer, loadEnvironmentFor, getRoutes, generateReport, reportUrl, geoSearch } from './api.js';
import { navigate, current, ROUTES } from './router.js';
import * as map from './map.js';
import { el, icon, toast, diagnosticError } from './widgets.js';
import { show as vizShow, hide as vizHide, splitPanels, kpiStrip } from './visuals.js';
import { lineChart, barChart, ringGauge, distributionArea, donut } from './charts.js';
import { flowchart, riskChain } from './flowchart.js';
import { bothTemps, tempF, num, km, mins, timeAgo, severityChip } from './widgets.js';
import { getSelectedRole, roleById, zoeProfileFor } from './roles.js';
import { windowPayload, clampHour } from './reportwindow.js';

// Scenario state lives in the scenarios screen module; resolved lazily to
// avoid any module cycle between the app shell and screens.
let getScenarioState = null;
import('../screens/scenarios.js')
  .then((m) => { getScenarioState = m.getScenario; })
  .catch(() => { /* screen module unavailable — context just omits it */ });

// Suggested prompts are role-aware (one engine, role-aware presentation).
function suggestedPrompts() {
  return zoeProfileFor(getSelectedRole()).suggestions;
}

let messagesEl = null;
let inputEl = null;
let busy = false;

// ---------------- context shaping ----------------

export function appContext() {
  const st = getState();
  const ctx = st.context;
  const heatTiles = (ctx && ctx.heatmap && ctx.heatmap.grid) || [];
  const topAreas = [...heatTiles]
    .filter((t) => t.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((t) => ({
      label: `Tile ${t.id} @ ${t.center ? t.center.lat.toFixed(3) + ',' + t.center.lon.toFixed(3) : 'n/a'}`,
      valueC: t.value,
      tempF: t.f != null ? Math.round(t.f) : null,
    }));
  return {
    screen: current() ? current().name : 'overview',
    demo: ctx ? !!ctx.demo : !!(st.health && st.health.demoDefault),
    // Role personalizes Zoe's emphasis (routes for business, alerts for
    // emergency, …) — it never gates data or invents facts.
    selectedRole: getSelectedRole(),
    activeLayer: st.gridLayer,
    location: ctx && ctx.location
      ? { id: ctx.location.id, display: ctx.location.display, lat: ctx.location.lat, lon: ctx.location.lon }
      : st.place ? { id: st.place.id, display: st.place.display, lat: st.place.lat, lon: st.place.lon } : null,
    heat: ctx && ctx.heatmap ? {
      stats: ctx.heatmap.stats,
      units: ctx.heatmap.units,
      fetchedAt: ctx.heatmap.fetchedAt,
      topAreas,
    } : null,
    exposure: ctx ? ctx.exposure : null,
    environment: ctx && ctx.environment ? { current: ctx.environment.current, hourly: ctx.environment.hourly || null } : null,
    selectedCell: st.selectedTile || null,
    alerts: ctx ? (ctx.alerts || []).slice(0, 6).map((a) => ({ id: a.id, type: a.type, severity: a.severity, location: a.location })) : [],
    assets: ctx ? (ctx.assets || []).filter((a) => a.risk).sort((a, b) => b.risk.index - a.risk.index).slice(0, 8)
      .map((a) => ({ id: a.id, name: a.name, category: a.category, tempF: a.tempF, risk: a.risk.band })) : [],
    routes: st.routes ? {
      from: st.routes.from, to: st.routes.to, mode: st.routes.mode,
      selectedRouteId: st.selectedRouteId,
      options: st.routes.routes.map((r) => ({
        id: r.id, label: r.label || r.id, durationSeconds: r.durationSeconds,
        distanceMeters: r.distanceMeters,
        exposure: r.exposure ? {
          band: r.exposure.band, score: r.exposure.score,
          minF: r.exposure.minF, meanF: r.exposure.meanF, maxF: r.exposure.maxF,
          coverage: r.coverage, sampledPoints: r.exposure.sampledPoints,
          peakSegment: r.exposure.peakSegment ? {
            index: r.exposure.peakSegment.index, avgF: r.exposure.peakSegment.avgF,
            band: r.exposure.peakSegment.exposure ? r.exposure.peakSegment.exposure.band : null,
          } : null,
        } : null,
      })),
    } : null,
    scenario: getScenarioState ? getScenarioState() : null,
    reports: {
      generated: stashedReports().length,
      latest: stashedReports()[0] ? { id: stashedReports()[0].id } : null,
    },
  };
}

// ---------------- panel rendering ----------------

function messageRow({ role, content, meta }) {
  const row = el('div', { class: `flex ${role === 'user' ? 'justify-end' : 'justify-start'}` });
  const bubble = el('div', {
    class: `${role === 'user' ? 'zoe-bubble-user' : 'zoe-bubble-bot'} max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed`,
  });
  bubble.appendChild(el('p', {}, content));
  if (meta && meta.statuses) {
    bubble.appendChild(el('div', { class: 'flex flex-wrap gap-1 mt-2' },
      meta.statuses.map((s) => el('span', { class: 'action-status' }, icon(s.done ? (s.failed ? 'error' : 'check_circle') : 'sync', 'text-[12px]', false), s.text))));
  }
  if (meta && meta.buttons && meta.buttons.length) {
    bubble.appendChild(actionButtonRow(meta.buttons));
  }
  if (meta && meta.mode) {
    const tag = el('div', { class: 'mt-1.5 flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider opacity-60' },
      icon(meta.mode === 'gemini' ? 'auto_awesome' : 'memory', 'text-[11px]', false),
      meta.mode === 'gemini' ? 'Gemini reasoning' : 'On-device engine');
    bubble.appendChild(tag);
  }
  row.appendChild(bubble);
  return row;
}

// Real action cards: every button executes through the same validated
// runAction pipeline — no decorative buttons.
function actionButtonRow(buttons) {
  return el('div', { class: 'flex flex-wrap gap-1.5 mt-2' },
    buttons.filter((b) => b && b.label && b.name).slice(0, 4).map((b) => el('button', {
      class: 'squishy-btn glass-chip rounded-full px-2.5 py-1 text-[11px] font-bold hover-lift',
      title: `Execute: ${b.name}`,
      onclick: async (evt) => {
        const btn = evt.currentTarget;
        btn.disabled = true;
        btn.classList.add('opacity-60');
        try {
          await runAction(b.name, b.args || {});
          btn.classList.remove('opacity-60');
          toast(`${b.label} — done.`, 'success');
        } catch (err) {
          btn.classList.remove('opacity-60');
          console.error(`[ZOE] button action ${b.name} failed`, err);
          toast(`${b.label} failed: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
        }
      },
    }, b.label)));
}

function renderHistory(host) {
  host.innerHTML = '';
  const hist = getState().zoeHistory;
  if (!hist.length) {
    host.appendChild(emptyIntro());
    return;
  }
  hist.forEach((m) => host.appendChild(messageRow(m)));
}

function emptyIntro() {
  const role = roleById(getSelectedRole());
  const profile = zoeProfileFor(getSelectedRole());
  return el('div', { class: 'flex flex-col gap-sm py-lg fade-in' },
    el('div', { class: 'flex flex-col items-center text-center gap-xs mb-md' },
      el('div', { class: 'w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center' },
        icon('smart_toy', 'text-[28px] text-on-primary')),
      el('h3', { class: 'font-black text-[17px] tracking-tight mt-1' }, 'Zoe'),
      el('p', { class: 'text-[12px] text-on-surface-variant/85 max-w-[240px]' },
        `THERMA's operator assistant${role ? ` for ${role.name}` : ''} — I run analyses, control the map and navigate the platform for you. Focus: ${profile.focus}.`)),
    el('div', { class: 'flex flex-col gap-1.5' },
      profile.suggestions.slice(0, 4).map((s) => el('button', {
        class: 'squishy-btn glass-chip rounded-xl px-3 py-2 text-left text-[12px] font-semibold hover-lift',
        onclick: () => send(s),
      }, s))),
    actionButtonRow(profile.actions.slice(0, 3)));
}

export function buildPanel(host) {
  host.innerHTML = '';

  // header
  const header = el('div', { class: 'flex items-center justify-between px-md pt-md pb-xs border-b border-outline-variant/20 dark:border-outline/10' },
    el('div', { class: 'flex items-center gap-2' },
      el('div', { class: 'relative' },
        el('div', { class: 'w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center' },
          icon('smart_toy', 'text-[19px] text-on-primary')),
        el('span', { class: 'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-surface dark:border-inverse-surface' })),
      el('div', {},
        el('p', { class: 'font-black tracking-tight leading-none' }, 'Zoe Operator'),
        el('p', { class: 'text-[10px] text-on-surface-variant/75 mt-0.5' }, 'Heat intelligence co-pilot'))),
    el('div', { class: 'flex items-center gap-1' },
      el('button', {
        class: 'p-2 rounded-full hover:bg-surface-container text-on-surface-variant',
        title: 'Clear conversation',
        'aria-label': 'Clear conversation',
        onclick: () => { setState({ zoeHistory: [] }); renderHistory(messagesEl); },
      }, icon('refresh', 'text-[18px]', false)),
      el('button', {
        class: 'hidden md:block p-2 rounded-full hover:bg-surface-container text-on-surface-variant',
        title: 'Collapse panel', 'aria-label': 'Close Zoe',
        onclick: () => close(),
      }, icon('close', 'text-[18px]', false))));

  messagesEl = el('div', {
    class: 'zoe-messages flex-1 overflow-y-auto px-md py-sm flex flex-col gap-2.5 min-h-0',
    'aria-live': 'polite',
  });

  const chips = el('div', { class: 'flex gap-1.5 overflow-x-auto pb-1 px-md shrink-0' },
    ['Hottest zone', 'Route exposure', 'Alerts', 'Generate report'].map((c) =>
      el('button', {
        class: 'glass-chip rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap squishy-btn',
        onclick: () => send(c),
      }, c)));

  inputEl = el('input', {
    class: 'flex-1 bg-transparent outline-none text-[13px] placeholder:text-on-surface-variant/50 min-w-0',
    placeholder: 'Ask Zoe or give an instruction…',
    'aria-label': 'Message Zoe',
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  const composer = el('div', { class: 'px-md pb-md pt-xs shrink-0' },
    el('div', { class: 'flex items-center gap-2 glass-chip rounded-2xl pl-4 pr-2 py-2' },
      inputEl,
      el('button', {
        class: 'w-9 h-9 rounded-xl bg-primary dark:bg-inverse-primary text-on-primary dark:text-inverse-on-surface flex items-center justify-center squishy-btn shrink-0',
        title: 'Send', 'aria-label': 'Send',
        onclick: () => send(),
      }, icon('arrow_upward', 'text-[18px]', false))),
    el('p', { class: 'text-[9px] text-on-surface-variant/55 mt-1.5 px-1' },
      'Zoe operates THERMA only — validated actions, no free-form code execution.'));

  host.appendChild(header);
  host.appendChild(messagesEl);
  host.appendChild(chips);
  host.appendChild(composer);
  renderHistory(messagesEl);
}

export function open() {
  setState({ zoeOpen: true });
  document.getElementById('zoe-panel').classList.remove('hidden');
  const mob = document.getElementById('zoe-mobile');
  mob.classList.add('hidden');
  const desktopHost = document.getElementById('zoe-content');
  if (!desktopHost.dataset.built) {
    buildPanel(desktopHost);
    desktopHost.dataset.built = '1';
  }
  // Always re-point the message/composer singletons at the surface the user
  // is actually looking at. If the mobile sheet was built first, these still
  // referenced its (now hidden) DOM and desktop sends vanished.
  messagesEl = desktopHost.querySelector('.zoe-messages');
  inputEl = desktopHost.querySelector('input[aria-label="Message Zoe"]');
  renderHistory(messagesEl);
  setTimeout(() => inputEl && inputEl.focus(), 120);
}

export function close() {
  setState({ zoeOpen: false });
  document.getElementById('zoe-panel').classList.add('hidden');
  document.getElementById('zoe-mobile').classList.add('hidden');
}

export function toggle() {
  getState().zoeOpen ? close() : open();
}

export function openMobile() {
  const mob = document.getElementById('zoe-mobile');
  const mobHost = mob.querySelector('#zoe-mobile-content');
  if (!mobHost.dataset.built) {
    buildPanel(mobHost);
    mobHost.dataset.built = '1';
  }
  // Point the singletons at the mobile surface (see open()).
  messagesEl = mobHost.querySelector('.zoe-messages');
  inputEl = mobHost.querySelector('input[aria-label="Message Zoe"]');
  renderHistory(messagesEl);
  mob.classList.remove('hidden');
  document.getElementById('zoe-panel').classList.add('hidden');
  setState({ zoeOpen: true });
}

// ---------------- messaging ----------------

async function send(presetText) {
  const text = (presetText ?? (inputEl ? inputEl.value : '')).trim();
  if (!text || busy) return;
  if (!presetText && inputEl) inputEl.value = '';
  busy = true;

  const history = getState().zoeHistory;
  history.push({ role: 'user', content: text });
  renderHistory(messagesEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const thinking = el('div', { class: 'flex justify-start' },
    el('div', { class: 'zoe-bubble-bot px-4 py-3 zoe-thinking text-on-surface-variant flex gap-1 items-center' },
      el('span', {}), el('span', {}), el('span', {})));
  messagesEl.appendChild(thinking);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await postZoe({
      message: text,
      context: appContext(),
      history: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    });
    thinking.remove();

    const statuses = [];
    const modelMsg = messageRow({ role: 'model', content: res.message, meta: { mode: res.mode, statuses } });
    messagesEl.appendChild(modelMsg);

    history.push({ role: 'model', content: res.message });
    setState({ zoeHistory: [...history] });

    if (res.actions && res.actions.length) {
      await executeActions(res.actions, statuses, modelMsg);
    }
    if (res.visualization && res.visualization.type !== 'text_only') {
      await handleVisualization(res.visualization);
    }
  } catch (err) {
    thinking.remove();
    messagesEl.appendChild(messageRow({ role: 'model', content: "I couldn't reach the THERMA reasoning service. Check the backend connection and try again.", meta: { mode: 'engine' } }));
    toast(err.message || 'Zoe request failed.', 'error');
  } finally {
    busy = false;
    renderHistory(messagesEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// ---------------- action execution ----------------

async function executeActions(actions, statuses, anchorMsg) {
  const statusWrap = anchorMsg.querySelector('.flex.flex-wrap.gap-1');
  for (const act of actions) {
    if (!act || typeof act !== 'object' || !act.name) continue;
    const label = statusLabel(act.name, act.args || {});
    statuses.push({ text: label, done: false });
    const chip = el('span', { class: 'action-status' }, icon('sync', 'text-[12px] spin-none', false), label);
    if (statusWrap) statusWrap.appendChild(chip);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
      await runAction(act.name, act.args || {});
      statuses[statuses.length - 1].done = true;
      if (chip) { chip.querySelector('.material-symbols-outlined').textContent = 'check_circle'; }
    } catch (err) {
      console.error(`[ZOE] action ${act.name} failed`, err);
      const detail = diagnosticError(err, 'Action failed');
      if (chip) {
        chip.querySelector('.material-symbols-outlined').textContent = 'error';
        chip.title = detail;
      }
      toast(`${label} failed: ${detail}`, 'error');
    }
    await sleep(160);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function statusLabel(name, args) {
  switch (name) {
    case 'navigate_to': return `Opening ${screenTitle(args.screen)}...`;
    case 'select_location': return `Locating ${args.query || args.id || 'location'}...`;
    case 'set_map_layer': return 'Changing map layer...';
    case 'zoom_map': return args.fullscreen ? 'Toggling fullscreen...' : 'Zooming map...';
    case 'reset_map': return 'Resetting map view...';
    case 'open_zoe': return 'Opening my workspace...';
    case 'close_zoe': return 'Closing my panel...';
    case 'open_sidebar': return 'Opening sidebar...';
    case 'close_sidebar': return 'Collapsing sidebar...';
    case 'run_heat_analysis': return 'Running heat analysis...';
    case 'run_environment_analysis': return 'Running environmental analysis...';
    case 'run_route_analysis': return 'Running route analysis...';
    case 'create_scenario': return 'Preparing scenario...';
    case 'compare_locations': return 'Comparing locations...';
    case 'open_asset': case 'open_property': case 'open_facility': return 'Opening asset profile...';
    case 'open_alert': return 'Opening alert...';
    case 'open_report': return 'Opening report...';
    case 'generate_report': return 'Generating report...';
    case 'open_decision_workspace': return 'Opening Decision Workspace...';
    case 'show_visualization': return 'Building visualization...';
    default: return `Running ${name.replace(/_/g, ' ')}...`;
  }
}

function screenTitle(name) {
  const titles = {
    overview: 'Overview', heat: 'Heat Intelligence', coolroute: 'CoolRoute', explorer: 'Map Explorer',
    environment: 'Environmental Intelligence', portfolio: 'Portfolio', urban: 'Urban & Property',
    facilities: 'Facilities', logistics: 'Logistics', utilities: 'Infrastructure & Utilities',
    risk: 'Risk & Insurance', scenarios: 'Scenarios', alerts: 'Active Alerts', reports: 'Reports Library',
    workspace: 'Decision Workspace', settings: 'Settings', search: 'Global Search', location: 'Location Detail',
  };
  return titles[name] || String(name || 'screen');
}

async function ensureContextFresh() {
  let st = getState();
  if (!st.context && st.place) {
    await loadContextFor(st.place.id);
    st = getState();
  }
  return st;
}

async function runAction(name, args) {
  const st = await ensureContextFresh();
  const placeId = st.place ? st.place.id : undefined;

  switch (name) {
    case 'navigate_to':
      navigate(args.screen, args.screen === 'workspace' ? { query: { mode: args.mode || '' } } : {});
      break;

    case 'select_location': {
      let place = null;
      if (args.id) place = { id: args.id };
      else if (args.lat != null && args.lon != null) place = { id: `${args.lat},${args.lon}` };
      else if (args.query) {
        const payload = await geoSearch(String(args.query));
        const results = (payload && payload.results) || [];
        if (results.length) place = results[0];
      }
      if (!place) throw new Error('Location not found');
      const ctx = await loadContextFor(place.id);
      map.focusPlace(ctx.location);
      toast(`Location set: ${ctx.location.display}`, 'success');
      break;
    }

    case 'set_map_layer': {
      const layer = normalizeLayer(args.layer);
      setState({ gridLayer: layer });
      if (placeId) await loadGridLayer(placeId, layer, { force: true });
      if (!['heat', 'explorer'].includes(current().name)) navigate('heat');
      break;
    }

    case 'zoom_map':
      if (args.fullscreen) map.toggleFullscreen();
      else map.zoomBy(Number(args.delta) || 1);
      break;

    case 'reset_map':
      map.resetView();
      break;

    case 'open_zoe': open(); break;
    case 'close_zoe': close(); break;

    case 'open_sidebar':
      if (window.innerWidth < 768) openDrawerSafe();
      else document.getElementById('sidebar').classList.contains('collapsed')
        && document.getElementById('sidebar-collapse-btn').click();
      break;

    case 'close_sidebar':
      if (window.innerWidth < 768) closeDrawerSafe();
      else if (!document.getElementById('sidebar').classList.contains('collapsed'))
        document.getElementById('sidebar-collapse-btn').click();
      break;

    case 'run_heat_analysis': {
      const layer = normalizeLayer(args.layer);
      setState({ gridLayer: layer });
      if (placeId) await Promise.all([loadContextFor(placeId), loadGridLayer(placeId, layer)]);
      if (!['heat', 'explorer'].includes(current().name)) navigate('heat');
      break;
    }

    case 'run_environment_analysis': {
      const mean = st.context && st.context.heatmap ? st.context.heatmap.stats.mean : 30;
      await loadEnvironmentFor(placeId, mean);
      if (current().name !== 'environment') navigate('environment');
      break;
    }

    case 'run_route_analysis':
      navigate('coolroute');
      window.dispatchEvent(new CustomEvent('therma:run-routes'));
      break;

    case 'create_scenario':
      navigate('scenarios');
      window.dispatchEvent(new CustomEvent('therma:new-scenario'));
      break;

    case 'compare_locations':
      navigate('workspace', { query: { mode: 'comparison' } });
      break;

    case 'open_asset': navigate('location', { param: `asset:${args.id}` }); break;
    case 'open_property': navigate('location', { param: `asset:${args.id}`, query: { view: 'property' } }); break;
    case 'open_facility': navigate('location', { param: `asset:${args.id}`, query: { view: 'facility' } }); break;

    case 'open_alert':
      navigate('alerts', { query: { highlight: args.id } });
      break;

    case 'open_report':
      if (args.id) window.open(reportUrl(args.id), '_blank', 'noopener');
      else navigate('reports');
      break;

    case 'generate_report': {
      if (!st.context) throw new Error('No context loaded yet');
      // Same pipeline as the Reports screen: POST /api/reports/generate.
      // Zoe may scope the analysis window from the user's phrasing; otherwise
      // the Reports screen's current selection applies.
      const ctx = JSON.parse(JSON.stringify(st.context));
      const w = args.window || args.requestedWindow;
      if (w && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end))) {
        const s = clampHour(w.start);
        const e = clampHour(w.end);
        ctx.requestedWindow = { start: Math.min(s, e), end: Math.max(s, e), duration: Math.abs(e - s) + 1 };
      } else {
        ctx.requestedWindow = windowPayload();
      }
      const rep = await generateReport(ctx);
      stashReport({ id: rep.id, meta: rep.meta });
      toast('Report generated.', 'success');
      navigate('reports', { query: { open: rep.id } });
      window.open(reportUrl(rep.id), '_blank', 'noopener');
      break;
    }

    case 'open_decision_workspace':
      navigate('workspace', { query: { mode: args.mode || 'split' } });
      break;

    case 'show_visualization':
      await handleVisualization({ type: args.type || 'graph', config: { mode: args.mode } });
      break;

    // NOTE: a 'set_theme' action used to live here. THERMA is dark-only — Zoe must
    // never switch themes — so the action is gone. Do not reintroduce it.

    default:
      console.warn('[ZOE] ignoring unknown action', name);
  }
}

function normalizeLayer(l) {
  const mapL = { temperature: 'temperature', heat: 'temperature', peak: 'time_of_measure', time: 'time_of_measure', persistence: 'persistence', exceedance: 'exceedance' };
  return mapL[String(l || '').toLowerCase()] || 'temperature';
}

function openDrawerSafe() {
  import('./sidebar.js').then((m) => m.openDrawer());
}
function closeDrawerSafe() {
  import('./sidebar.js').then((m) => m.closeDrawer());
}

// ---------------- reports stash ----------------

export function stashReport(meta) {
  try {
    const list = JSON.parse(sessionStorage.getItem('therma.reports') || '[]');
    list.unshift(meta);
    sessionStorage.setItem('therma.reports', JSON.stringify(list.slice(0, 25)));
  } catch { /* ignore */ }
}
export function stashedReports() {
  try { return JSON.parse(sessionStorage.getItem('therma.reports') || '[]'); } catch { return []; }
}

// ---------------- visualizations ----------------

export async function handleVisualization(viz) {
  const type = viz.type || 'text_only';
  const cfg = viz.config || {};
  const mode = cfg.mode || '';
  const st = await ensureContextFresh();
  const ctx = st.context;
  if (type === 'text_only') return;

  const wantsMap = type.includes('map');
  const wantsGraph = type.includes('graph');
  const wantsFlow = type.includes('flowchart');

  if (wantsMap && ctx) {
    // focus the main map on the relevant area/layer
    if (mode === 'layer' && cfg.layer) {
      const layer = normalizeLayer(cfg.layer);
      setState({ gridLayer: layer });
      if (st.place) loadGridLayer(st.place.id, layer).catch(() => {});
    }
    if (ctx.location) map.focusPlace(ctx.location);
  }

  const panels = [];
  let title = 'Zoe visualization';
  let iconName = 'insights';

  if (mode === 'hottest' && ctx) {
    title = 'Hottest zones in ' + ctx.location.display;
    iconName = 'local_fire_department';
    const tiles = ((ctx.heatmap && ctx.heatmap.grid) || []).filter((t) => t.value != null).sort((a, b) => b.value - a.value).slice(0, 6);
    panels.push({
      title: 'Top thermal cells (°F)',
      node: barChart({ items: tiles.map((t, i) => ({ label: `Zone ${i + 1}`, value: Math.round(t.f), color: i === 0 ? '#b91c1c' : '#f97316' })), fmt: (v) => `${v}°F` }),
    });
    panels.push({
      title: 'Exposure position',
      node: ringGauge({ value: ctx.exposure ? ctx.exposure.score : null, label: 'Exposure', color: '#f97316', sublabel: `${ctx.exposure ? ctx.exposure.level : ''} · THERMA analysis` }),
    });
  }

  if (mode === 'risk' && ctx) {
    title = 'Risk reasoning chain — ' + ctx.location.display;
    iconName = 'psychology';
    panels.push({ title: 'HEAT → EXPOSURE → RISK → PRIORITY → ACTION', node: riskChain(ctx.exposure) });
  }

  if (mode === 'routes' && st.routes) {
    title = 'Thermal route comparison';
    iconName = 'route';
    const rs = st.routes.routes.filter((r) => r.exposure);
    panels.push({
      title: 'Mean exposure per route (°F)',
      node: rs.length ? barChart({
        items: rs.map((r) => ({ label: r.label || r.id, value: r.exposure.meanF, color: r.exposure.band === 'Extreme' ? '#b91c1c' : '#f97316' })),
        fmt: (v) => `${Math.round(v)}°F`,
      }) : el('p', { class: 'text-[12px] text-on-surface-variant py-md text-center' }, 'No analyzed routes yet.'),
    });
    panels.push({
      title: 'Duration vs heat',
      node: rs.length ? lineChart({
        labels: rs.map((r) => r.label || r.id),
        series: [{ name: 'Duration (min)', color: '#2b7de9', points: rs.map((r) => r.durationSeconds / 60) }],
        yFmt: (v) => `${Math.round(v)}m`, area: false,
      }) : null,
    });
  }

  if (mode === 'alerts' && ctx) {
    title = 'Active alerts overview';
    iconName = 'notification_important';
    const bySev = {};
    (ctx.alerts || []).forEach((a) => { bySev[a.severity] = (bySev[a.severity] || 0) + 1; });
    panels.push({
      title: 'By severity',
      node: donutSafe(bySev),
    });
    panels.push({
      title: 'Latest',
      node: el('div', { class: 'flex flex-col gap-1.5' }, (ctx.alerts || []).slice(0, 4).map((a) =>
        el('div', { class: 'glass-chip rounded-xl px-3 py-2 flex items-center gap-2' },
          severityChip(a.severity),
          el('span', { class: 'text-[12px] font-semibold truncate' }, a.type),
          el('span', { class: 'text-[11px] text-on-surface-variant ml-auto whitespace-nowrap' }, a.location)))),
    });
  }

  if (mode === 'environment' && ctx && ctx.environment) {
    title = 'Environmental profile — ' + ctx.location.display;
    iconName = 'air';
    const cur = ctx.environment.current;
    panels.push({
      title: 'Apparent vs heat index (°C)',
      node: ctx.environment.hourly ? lineChart({
        labels: ctx.environment.hourly.apparentTemp.map((_, i) => `+${i}h`),
        series: [
          { name: 'Heat index °C', color: '#f97316', points: ctx.environment.hourly.heatIndex },
          { name: 'Apparent °C', color: '#2b7de9', points: ctx.environment.hourly.apparentTemp },
        ],
        yFmt: (v) => `${Math.round(v)}°`,
      }) : el('p', { class: 'py-md text-[12px] text-on-surface-variant' }, 'Hourly series unavailable.'),
    });
    panels.push({
      title: 'Current conditions',
      node: kpiStrip([
        { label: 'Heat index', value: tempF(cur.heatIndexC, 1) },
        { label: 'Humidity', value: cur.humidity != null ? Math.round(cur.humidity) + '%' : '—' },
        { label: 'AQI', value: cur.aqi != null ? Math.round(cur.aqi) : '—' },
        { label: 'Solar', value: cur.solarIrradiance != null ? Math.round(cur.solarIrradiance) + ' W/m²' : '—' },
      ]),
    });
  }

  if (mode === 'priority' && ctx) {
    title = 'Priority ranking — ' + ctx.location.display;
    iconName = 'low_priority';
    const ranked = ctx.assets.filter((a) => a.risk).sort((a, b) => b.risk.index - a.risk.index).slice(0, 6);
    panels.push({
      title: 'Assets by risk index',
      node: ranked.length ? barChart({
        items: ranked.map((a) => ({ label: a.name, value: a.risk.index * 20, color: a.risk.index >= 4 ? '#b91c1c' : '#f97316' })),
        fmt: (v) => `${v}`,
      }) : el('p', { class: 'py-md text-[12px] text-on-surface-variant text-center' }, 'Load heat data to rank assets.'),
    });
    panels.push({ title: 'Reasoning chain', node: riskChain(ctx.exposure) });
  }

  if (mode === 'assets' && ctx) {
    title = 'Asset exposure snapshot';
    iconName = 'domain';
    const ranked = ctx.assets.filter((a) => a.risk).sort((a, b) => b.risk.index - a.risk.index).slice(0, 6);
    panels.push({ title: 'Hottest assets (°F)', node: ranked.length ? barChart({ items: ranked.map((a) => ({ label: a.name, value: a.tempF, color: '#f97316' })), fmt: (v) => `${Math.round(v)}°F` }) : null });
  }

  if (mode === 'comparison') {
    title = 'Comparison workspace';
    iconName = 'compare_arrows';
    panels.push({ title: 'Use the Decision Workspace for full comparison', node: el('p', { class: 'text-[12px] text-on-surface-variant py-sm' }, 'Side-by-side map, graph and reasoning views are available in the Decision Workspace.') });
  }

  if (mode === 'split') {
    title = 'Decision snapshot';
    iconName = 'space_dashboard';
    if (ctx && ctx.heatmap && ctx.heatmap.distribution && ctx.heatmap.distribution.frequency) {
      panels.push({
        title: 'Temperature distribution',
        node: distributionArea({ axis: ctx.heatmap.distribution.frequency.axis, counts: ctx.heatmap.distribution.frequency.counts }),
      });
    }
    panels.push({ title: 'Reasoning chain', node: ctx ? riskChain(ctx.exposure) : null });
  }

  if (!panels.length) {
    if (ctx && ctx.heatmap && ctx.heatmap.distribution && ctx.heatmap.distribution.frequency) {
      panels.push({
        title: 'Temperature distribution (°F)',
        node: distributionArea({ axis: ctx.heatmap.distribution.frequency.axis, counts: ctx.heatmap.distribution.frequency.counts }),
      });
    } else if (ctx) {
      panels.push({ title: 'Reasoning chain', node: riskChain(ctx.exposure) });
    }
  }

  if (!panels.length) return;

  const source = ctx ? ctx.source : 'therma-analysis';
  const demo = ctx ? ctx.demo : true;
  vizShow({
    title, iconName,
    source: wantsGraph || wantsFlow ? 'therma-analysis' : source,
    demo,
    sticky: true,
    build: (body) => body.appendChild(splitPanels(panels)),
  });
}

function donutSafe(bySev) {
  const colors = { Critical: '#b91c1c', High: '#f97316', Medium: '#eab308', Low: '#2b7de9', Standard: '#2b7de9' };
  return donut({
    segments: Object.entries(bySev).map(([label, value]) => ({ label, value, color: colors[label] || '#747878' })),
    centerLabel: String(Object.values(bySev).reduce((a, b) => a + b, 0)),
    centerSub: 'alerts',
  });
}

export function bindMobileZoe() {
  document.querySelectorAll('[data-zoe-mobile-close]').forEach((x) =>
    x.addEventListener('click', () => {
      document.getElementById('zoe-mobile').classList.add('hidden');
      // Zoe is an on-demand overlay on both breakpoints now, so dismissing the
      // mobile sheet really does close Zoe (this used to leave zoeOpen true for the
      // old always-on desktop rail, which desynced toggle()).
      setState({ zoeOpen: false });
    }));
}

// Event bus entry so screens can prompt Zoe programmatically.
window.addEventListener('therma:zoe-send', (e) => {
  const text = e.detail && String(e.detail);
  if (!text) return;
  open();
  setTimeout(() => send(text), 180);
});

// Entry point for the full-screen operator workspace: executes a validated
// action through the same pipeline (no direct access to internals).
export function executeForWorkspace(name, args) {
  return runAction(name, args || {});
}
