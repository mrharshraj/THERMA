// Overview — command overview screen (command_overview).

import { getState, setState } from '../app/store.js';
import { loadContextFor, loadGridLayer } from '../app/api.js';
import { el, icon, pageHeader, statTile, card, sourceBadge, severityChip, bandChip, timeAgo, btnPrimary, btnGhost, errorState, loadingState, tempF, num, emptyState, toast } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { bestTimeCard } from '../app/besttime.js';
import { layerDomain, colorFor, legendFor } from '../app/layers.js';
import { ringGauge, sparkline } from '../app/charts.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';
import { openMobile as zoeOpenMobile } from '../app/zoe.js';
import { getSelectedRole, kpiSetFor, emphasisFor, orderRecommendations, roleRecommendation, roleById } from '../app/roles.js';

export default {
  title: 'Overview',
  async render(container) {
    const st = getState();
    const ctx = st.context;

    // Register the data-refresh hook FIRST (loading/error branches return
    // early below; a screen mounted mid-load must still update when data lands).
    screenEvent(window, 'therma:context', () => rerenderScreen('overview', container));

    const header = pageHeader({
      eyebrow: 'THERMA COMMAND',
      title: 'Command Overview',
      subtitle: `Live operational picture for <b>${currentPlaceLabel()}</b> — heat intelligence, exposure risk, assets and alerts in one view.`,
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Ask Zoe', 'smart_toy', () => (window.innerWidth < 768 ? zoeOpenMobile() : toggleZoe())),
      ],
    });
    container.appendChild(wrap(header));

    if (!ctx && st.contextLoading) {
      container.appendChild(loadingState('Generating hyperlocal heat intelligence…', 'FortyGuard analysis typically completes within a minute.'));
      return;
    }
    if (!ctx && st.contextError) {
      container.appendChild(errorState({
        title: 'Live heat intelligence unavailable.',
        message: null,
        err: st.contextError,
        retry: () => loadContextFor(getState().place.id),
        onRelocate: () => navigate('search'),
        onDemo: () => import('../app/placepick.js').then((m) => m.setDemoMode(true)),
      }));
      return;
    }
    if (!ctx) return;

    // ---------- KPI row ----------
    const hm = ctx.heatmap || {};
    const stats = hm.stats || {};
    container.appendChild(kpiRow(ctx));

    // ---------- role emphasis line (ordering/emphasis only — same data) ----------
    const roleId = getSelectedRole();
    const emphasis = emphasisFor(roleId);
    const roleMeta = roleById(roleId);
    if (emphasis && roleMeta) {
      container.appendChild(el('div', { class: 'flex items-center gap-sm mb-md glass-chip rounded-full px-3 py-1.5 self-start fade-in' },
        icon(roleMeta.icon, 'text-[15px] text-on-surface-variant', false),
        el('span', { class: 'text-[11.5px] font-bold' }, emphasis.title),
        el('span', { class: 'text-[11.5px] text-on-surface-variant/85 truncate' }, emphasis.line)));
    }

    // ---------- main grid ----------
    const grid = el('div', { class: 'grid gap-md grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]' });

    // Map panel
    const mapHost = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[380px] bg-surface-container-low' });
    const mapCtrls = el('div', { class: 'absolute top-3 right-3 z-[500] flex flex-col gap-1.5' },
      mapCtrl('my_location', 'Locate me', () => map.locateMe()),
      mapCtrl('fit_screen', 'Fit area', () => ctx.location && map.focusPlace(ctx.location)),
      mapCtrl('fullscreen', 'Fullscreen', () => map.toggleFullscreen(mapHost)));
    const legend = buildLegend(hm);
    mapHost.appendChild(mapCtrls);
    if (legend) mapHost.appendChild(legend);

    const leftCol = el('div', { class: 'flex flex-col gap-md min-w-0' }, mapHost);

    // Right column
    const rightCol = el('div', { class: 'flex flex-col gap-md min-w-0' });

    // Heat status
    const exp = ctx.exposure || {};
    const heatStatusCard = card({
      title: 'Heat Status', ic: 'device_thermostat',
      children: el('div', { class: 'flex items-center gap-md' },
        ringGauge({ value: exp.score, label: exp.level || '', color: levelColor(exp.level) }),
        el('div', { class: 'flex flex-col gap-1.5 text-[12px]' },
          el('div', {}, el('span', { class: 'font-bold text-[13px]' }, bothFmt(stats.mean)), el('span', { class: 'text-on-surface-variant/80 block text-[10.5px]' }, 'Mean surface temp')),
          el('div', {}, el('span', { class: 'font-bold text-[13px]' }, `${tempF(stats.max)} peak`), el('span', { class: 'text-on-surface-variant/80 block text-[10.5px]' }, 'Hottest cell estimate')),
          driversLine(exp))),
      });

    // Best-time-to-go-outside (compact, from the context environment feed)
    const bestTimeHost = el('div', { class: 'flex flex-col gap-md min-w-0' });
    if (ctx.environment) {
      bestTimeHost.appendChild(card({
        title: 'Best Time Outside', ic: 'schedule',
        actions: [el('button', { class: 'text-[11px] font-bold text-on-surface-variant hover:text-on-surface hover:underline', onclick: () => navigate('environment') }, 'Details')],
        children: bestTimeCard(ctx.environment, { compact: true }),
      }));
    }

    // Alerts preview
    const alerts = ctx.alerts || [];
    const alertsCard = card({
      title: `Active Alerts (${alerts.length})`, ic: 'notification_important',
      actions: [el('button', { class: 'text-[11px] font-bold text-on-surface-variant hover:text-on-surface hover:underline', onclick: () => navigate('alerts') }, 'View all')],
      children: alerts.length ? el('div', { class: 'flex flex-col gap-1.5' },
        alerts.slice(0, 3).map((a) => alertRow(a))) : emptyState({ ic: 'notifications_off', title: 'No active alerts', message: 'Rules engine found no threshold breaches for this area.' }),
    });

    // Role-aware column order: response-driven roles lead with alerts, research
    // leads with the thermal picture. Same cards, different emphasis.
    const alertsFirst = roleId === 'emergency' || roleId === 'government';
    if (alertsFirst) rightCol.appendChild(alertsCard);
    rightCol.appendChild(heatStatusCard);
    rightCol.appendChild(bestTimeHost);
    if (!alertsFirst) rightCol.appendChild(alertsCard);

    // Recommendations — real context output, ordered by role affinity, plus one
    // grounded role-specific lead (computed from the same context, never invented).
    const recs = orderRecommendations(roleId, ctx.recommendations || []);
    const roleRec = roleRecommendation(roleId, ctx);
    const allRecs = roleRec ? [roleRec, ...recs] : recs;
    rightCol.appendChild(card({
      title: 'Priority Recommendations', ic: 'tips_and_updates',
      actions: [el('button', { class: 'text-[11px] font-bold text-on-surface-variant hover:text-on-surface hover:underline', onclick: () => navigate('workspace') }, 'Decision Workspace')],
      children: allRecs.length ? el('div', { class: 'flex flex-col gap-2' },
        allRecs.slice(0, 3).map((r) => el('div', { class: 'glass-chip rounded-xl p-2.5' },
          el('div', { class: 'flex items-center justify-between gap-2 mb-1' },
            el('span', { class: 'text-[12px] font-bold' }, r.title),
            severityChip(r.priority)),
          el('p', { class: 'text-[11.5px] text-on-surface-variant/90 leading-snug' }, r.detail)))) : emptyState({ ic: 'task_alt', title: 'No recommendations', message: 'Conditions are stable for the selected area.' }),
    }));

    // Quick actions under map
    leftCol.appendChild(el('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-xs' },
      quickAction('local_fire_department', 'Run Heat Analysis', async () => {
        toast('Running heat analysis…');
        await Promise.all([
          loadContextFor(getState().place.id),
          import('../app/api.js').then((m) => m.loadGridLayer(getState().place.id, getState().gridLayer)),
        ]);
        navigate('heat');
      }),
      quickAction('route', 'Plan CoolRoute', () => navigate('coolroute')),
      quickAction('description', 'Generate Report', () => runReport()),
      quickAction('air', 'Environment', () => navigate('environment'))));

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);

    // Mount the real map after layout.
    requestAnimationFrame(() => {
      map.mount(mapHost);
      renderMapLayers();
    });
  },
};

async function runReport() {
  const st = getState();
  try {
    toast('Generating report…');
    const { generateReport, reportUrl } = await import('../app/api.js');
    const rep = await generateReport(JSON.parse(JSON.stringify(st.context)));
    const { stashReport } = await import('../app/zoe.js');
    stashReport({ id: rep.id, meta: rep.meta });
    toast('Report generated.', 'success');
    navigate('reports', { query: { open: rep.id } });
    // Must be the API path: /reports/:id is swallowed by the SPA fallback and
    // returns index.html instead of the report (E1).
    window.open(reportUrl(rep.id), '_blank', 'noopener');
  } catch (err) {
    toast(err.message || 'Report generation failed.', 'error');
  }
}

function wrap(header) {
  const w = el('div', { class: 'flex flex-col min-h-0' });
  w.appendChild(header);
  return w;
}

function currentPlaceLabel() {
  const st = getState();
  return (st.context && st.context.location && st.context.location.display) || (st.place && st.place.display) || '—';
}

function kpiRow(ctx) {
  const stats = (ctx.heatmap && ctx.heatmap.stats) || {};
  const tiles = (ctx.heatmap && ctx.heatmap.grid) || [];
  const alertsN = (ctx.alerts || []).length;
  const assetsN = (ctx.assets || []).length;
  const hotAssets = (ctx.assets || []).filter((a) => a.risk && a.risk.index >= 4).length;
  const exp = ctx.exposure || {};
  const meanF = stats.mean != null ? Math.round(stats.mean * 9 / 5 + 32) : null;

  // Real, computable values per key. A KPI that cannot be computed from the
  // current context is dropped — never faked (roles only reorder/relabel).
  const available = {
    mean: { label: 'Mean Surface', value: meanF != null ? `${meanF}°F` : '—', sub: `${ctx.location.display} · today`, ic: 'thermostat' },
    range: { label: 'Thermal Range', value: `${stats.min != null ? Math.round(stats.min * 9 / 5 + 32) : '—'}–${stats.max != null ? Math.round(stats.max * 9 / 5 + 32) : '—'}°F`, sub: `${num(tiles.length)} cells analyzed`, ic: 'unarchive' },
    alerts: { label: 'Active Alerts', value: String(alertsN), sub: alertsN ? 'Rules-engine breaches' : 'All clear', ic: 'notification_important' },
    assets: { label: 'Assets Monitored', value: String(assetsN), sub: hotAssets ? `${hotAssets} in high/critical bands` : 'None in critical bands', ic: 'domain' },
    hotAssets: { label: 'High-Risk Assets', value: String(hotAssets), sub: hotAssets ? 'high or critical bands' : 'None above threshold', ic: 'warning' },
    exposure: { label: 'Heat Exposure', value: exp.score != null ? `${exp.score}/100` : '—', sub: exp.level ? `${exp.level} · area score` : 'area score', ic: 'local_fire_department' },
  };
  // Role set chooses order + labels; any key missing data falls back to the
  // remaining base KPIs so the row is never sparse or invented.
  const set = kpiSetFor(getSelectedRole());
  const tilesOut = [];
  for (const k of set) {
    const base = available[k.key];
    if (!base) continue;
    tilesOut.push(statTile({ ...base, label: k.label || base.label }));
    delete available[k.key];
  }
  for (const k of Object.keys(available)) {
    if (tilesOut.length >= 5) break;
    tilesOut.push(statTile(available[k]));
  }
  return el('div', { class: 'grid gap-xs mb-md', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } }, ...tilesOut.slice(0, 5));
}

function alertRow(a) {
  return el('button', {
    class: 'w-full glass-chip rounded-xl p-2.5 flex items-start gap-2 text-left hover-lift',
    onclick: () => navigate('alerts', { query: { highlight: a.id } }),
  },
  severityChip(a.severity),
  el('span', { class: 'min-w-0 flex-1' },
    el('span', { class: 'block text-[12px] font-bold truncate' }, `${a.type} · ${a.location}`),
    el('span', { class: 'block text-[11px] text-on-surface-variant/85 truncate' }, a.description)),
  el('span', { class: 'text-[9.5px] text-on-surface-variant/60 whitespace-nowrap mt-0.5' }, timeAgo(a.time)));
}

function quickAction(icName, label, onClick) {
  return el('button', {
    class: 'squishy-btn glass-panel rounded-xl px-3 py-2.5 flex items-center gap-2 text-[12px] font-bold hover-lift',
    onclick: onClick,
  }, icon(icName, "text-[17px] text-on-surface-variant"), label);
}

function mapCtrl(icName, title, onClick) {
  return el('button', {
    class: 'map-ctrl', title, 'aria-label': title,
    onclick: onClick,
  }, icon(icName, 'text-[18px]', false));
}

function buildLegend(hm) {
  const layer = (hm && hm.layer) || getState().gridLayer || 'temperature';
  const def = legendFor(layer, layerDomain(layer, (hm && hm.grid) || []));
  return el('div', { class: 'glass-panel absolute bottom-4 left-3 z-[500] rounded-xl px-3 py-2 fade-in' },
    el('p', { class: 'text-[9px] font-black uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1' }, def.title),
    el('div', { class: 'w-40 h-2.5 rounded-full mb-1', style: { background: `linear-gradient(90deg, ${def.stops.join(', ')})` } }),
    el('div', { class: 'flex justify-between w-40' },
      def.labels.map((lb, i) => el('span', { class: 'text-[8.5px] font-bold text-on-surface-variant/80' }, lb))));
}

function levelColor(level) {
  return { Critical: '#b91c1c', High: '#f97316', Moderate: '#eab308', Low: '#2b7de9', Minimal: '#57b1ff' }[level] || '#f97316';
}

function bothFmt(c) {
  return c == null ? '—' : `${Math.round(c * 9 / 5 + 32)}°F`;
}

function driversLine(exp) {
  if (!exp.drivers || !exp.drivers.length) return el('span', { class: 'text-[11px] text-on-surface-variant/80' }, 'Baseline thermal conditions.');
  return el('div', { class: 'flex flex-col gap-0.5' },
    el('span', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, 'Drivers'),
    exp.drivers.slice(0, 3).map((d) => el('span', { class: 'text-[11px]', html: `• ${d}` })));
}

// Draws the heat grid + asset markers onto the mounted map. The grid comes from
// the /context/grid payload (full geometry WITH bounds) via loadGridLayer — the
// same path heat.js and explorer.js use. The slim /context grid (ctx.heatmap.grid)
// carries no bounds, so drawing from it renders zero tiles.
export async function renderMapLayers() {
  const st = getState();
  const ctx = st.context;
  if (!ctx) return;
  let payload = null;
  try {
    payload = await loadGridLayer(st.place.id, st.gridLayer || 'temperature');
  } catch { /* markers-only fallback if the layer can't load */ }
  const layer = (payload && payload.layer) || st.gridLayer || 'temperature';
  const tiles = ((payload && payload.grid) || []).filter((t) => t.value != null);
  const domain = layerDomain(layer, tiles);
  map.drawGrid(tiles.map((t) => ({ ...t, units: payload && payload.units })), {
    colorOf: (t) => colorFor(layer, t, domain),
    opacity: 0.55,
    onClick: (t) => {
      map.highlightTile(t);
      const band = t.layer ? ` (${t.layer.band})` : '';
      const reading = t.f != null ? `${Math.round(t.f)}°F` : `${Number(t.value).toFixed(1)}${payload && payload.units === 'hour' ? 'h' : ''}`;
      toast(`Cell ${t.id}: ${reading}${band}`);
    },
  });
  if (ctx.location) map.focusPlace(ctx.location);
  const assets = (ctx.assets || []).slice(0, 25);
  assets.forEach((a) => {
    map.addMarker({
      lat: a.lat, lon: a.lon, label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
      category: a.category,
      color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
      onClick: () => navigate('location', { param: `asset:${a.id}` }),
    });
  });
}
