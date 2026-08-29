// Heat Intelligence — interactive thermal map screen (heat_intelligence_analysis).

import { getState, setState } from '../app/store.js';
import { loadContextFor, loadGridLayer } from '../app/api.js';
import { el, icon, pageHeader, card, statTile, sourceBadge, bandChip, tempF, tempC, num, clockTime, loadingState, errorState, emptyState, btnGhost, toast } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { distributionArea } from '../app/charts.js';
import { layerDomain, colorFor, legendFor, describeTile, unitOf } from '../app/layers.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';
import { openMobile as zoeOpenMobile } from '../app/zoe.js';

const LAYERS = [
  { id: 'temperature', label: 'Temperature', ic: 'thermostat' },
  { id: 'persistence', label: 'Persistence', ic: 'schedule' },
  { id: 'exceedance', label: 'Exceedance', ic: 'moving' },
  { id: 'time_of_measure', label: 'Peak Time', ic: 'wb_twilight' },
];

let selectedTile = null;
let infoCardEl = null;

export default {
  title: 'Heat Intelligence',
  layout: 'fixed',   // lg+: fixed map shell + scrolling right rail; below lg the page scrolls
  async render(container) {
    selectedTile = null;
    const st = getState();
    const ctx = st.context;

    // Register the data-refresh hook FIRST (loading/error branches return
    // early below; a screen mounted mid-load must still update when data lands).
    screenEvent(window, 'therma:context', () => rerenderScreen('heat', container));

    container.appendChild(pageHeader({
      eyebrow: 'FORTYGUARD TEMPERATURE API',
      title: 'Heat Intelligence',
      subtitle: ctx ? `Hyperlocal ${ctx.heatmap && ctx.heatmap.units === 'hour' ? 'exposure-hours' : 'temperature'} analysis for <b>${ctx.location.display}</b>. Click any cell to inspect it.` : 'Hyperlocal thermal analysis.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Ask Zoe', 'smart_toy', () =>
          window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Why is this location high risk?' }))),
      ],
    }));

    if (!ctx && st.contextLoading) {
      container.appendChild(loadingState('Generating hyperlocal heat intelligence…',
        'FortyGuard is computing the temperature layer for this area — typically under a minute.'));
      return;
    }
    if (!ctx && st.contextError) {
      container.appendChild(errorState({
        title: 'Live heat intelligence unavailable.',
        err: st.contextError,
        retry: () => loadContextFor(getState().place.id),
        onRelocate: () => navigate('search'),
        onDemo: () => import('../app/placepick.js').then((m) => m.setDemoMode(true)),
      }));
      return;
    }
    if (!ctx) return;

    const hm = ctx.heatmap || {};
    const body = el('div', { class: 'flex gap-md flex-1 min-h-0' });

    // ---------- map column ----------
    const mapWrap = el('div', { class: 'relative flex-1 rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 bg-surface-container-low min-h-[420px]' });
    buildMapOverlay(mapWrap, ctx);
    body.appendChild(mapWrap);

    // ---------- right rail ----------
    const rail = el('div', { class: 'hidden lg:flex w-[330px] xl:w-[360px] shrink-0 flex-col gap-md overflow-y-auto pr-1' });

    // layer switcher
    rail.appendChild(layerSwitcher(ctx));

    // stats
    rail.appendChild(statsGrid(hm));

    // selected tile inspector
    infoCardEl = tileInspector(null);
    rail.appendChild(infoCardEl);

    // distribution
    rail.appendChild(distributionCard(hm));

    rail.appendChild(card({
      title: 'Zoe Insights', ic: 'smart_toy',
      children: el('div', { class: 'flex flex-col gap-xs' },
        el('p', { class: 'text-[12px] text-on-surface-variant/90' }, 'Ask Zoe to explain hotspots, run a fresh analysis, or switch layers — she operates the map for you.'),
        el('button', {
          class: 'squishy-btn bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface rounded-full px-4 py-2 text-[12px] font-bold self-start mt-1',
          onclick: () => askZoeHottest(),
        }, 'Why is this area hot?')),
    }));

    body.appendChild(rail);

    // mobile stats below map
    const mobileStats = el('div', { class: 'lg:hidden flex flex-col gap-md mt-md' },
      layerSwitcher(ctx), statsGrid(hm), distributionCard(hm));

    container.appendChild(body);
    container.appendChild(mobileStats);

    requestAnimationFrame(async () => {
      map.mount(mapWrap);
      await paintLayer();
      screenEvent(window, 'therma:grid', onGridEvent);
    });
  },
};

async function askZoeHottest() {
  window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Which area is hottest?' }));
}

function onGridEvent(e) {
  const payload = e.detail;
  setState({ gridLayer: payload.layer });
  paintTiles(payload);
}

function buildMapOverlay(mapWrap, ctx) {
  const ctrls = el('div', { class: 'absolute top-3 right-3 z-[500] flex flex-col gap-1.5' },
    overlayBtn('my_location', 'Locate me', () => map.locateMe()),
    overlayBtn('refresh', 'Reset view', () => map.resetView()),
    overlayBtn('fullscreen', 'Fullscreen', () => map.toggleFullscreen(mapWrap)));
  mapWrap.appendChild(ctrls);

  const legend = el('div', { class: 'glass-panel absolute bottom-4 left-3 z-[500] rounded-xl px-3 py-2 fade-in', dataset: { layerLegend: '' } },
    el('p', { class: 'text-[9px] font-black uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1' }, ''),
    el('div', { class: 'w-44 h-2.5 rounded-full mb-1', style: { background: '#555' } }),
    el('div', { class: 'flex justify-between w-44 text-[8.5px] font-bold text-on-surface-variant/85' }));
  mapWrap.appendChild(legend);
  renderLayerLegends(getState().gridLayer);

  const loadingChip = el('div', {
    class: 'glass-panel absolute top-3 left-3 z-[500] hidden items-center gap-2 rounded-full px-3 py-1.5',
    id: 'layer-loading-chip',
  }, el('div', { class: 'spinner', style: { width: '14px', height: '14px', borderWidth: '2px' } }),
  el('span', { class: 'text-[11px] font-bold' }, 'Generating hyperlocal heat intelligence…'));
  mapWrap.appendChild(loadingChip);

  const srcChip = el('div', { class: 'glass-panel absolute bottom-4 right-3 z-[500] rounded-full px-3 py-1.5' }, sourceBadge(ctx.source === 'live' ? 'fortyguard' : 'demo', ctx.demo));
  mapWrap.appendChild(srcChip);
}

function overlayBtn(icName, title, onClick) {
  return el('button', { class: 'map-ctrl', title, 'aria-label': title, onclick: onClick }, icon(icName, 'text-[18px]', false));
}

// Layer-aware legend: gradient + labels + title come from the SAME pipeline
// that colors the cells (app/layers.js), so the legend always matches the map.
let layerDomainCache = null;

function renderLayerLegends(layer) {
  const def = legendFor(layer, layerDomainCache);
  document.querySelectorAll('[data-layer-legend]').forEach((box) => {
    const title = box.querySelector('p');
    const bar = box.querySelector('div[style]');
    const labels = box.querySelector('.flex.justify-between');
    if (title) title.textContent = def.title.toUpperCase();
    if (bar) bar.style.background = `linear-gradient(90deg, ${def.stops.join(', ')})`;
    if (labels) {
      labels.innerHTML = '';
      def.labels.forEach((t) => labels.appendChild(el('span', {}, t)));
    }
  });
}

function layerSwitcher(ctx) {
  return card({
    title: 'Analysis Layer', ic: 'layers', pad: true,
    children: el('div', { class: 'grid grid-cols-2 gap-xs' },
      LAYERS.map((l) => el('button', {
        class: `squishy-btn rounded-xl px-3 py-2 flex items-center gap-2 text-[11.5px] font-bold border ${
          getState().gridLayer === l.id
            ? 'bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface border-transparent'
            : 'glass-chip border-transparent hover:bg-surface-container/70'
        }`,
        dataset: { layerBtn: l.id },
        onclick: () => switchLayer(l.id),
      }, icon(l.ic, 'text-[15px]', false), l.label))),
  });
}

async function switchLayer(layer) {
  setState({ gridLayer: layer });
  document.querySelectorAll('[data-layer-btn]').forEach((b) => {
    const active = b.dataset.layerBtn === layer;
    b.className = `squishy-btn rounded-xl px-3 py-2 flex items-center gap-2 text-[11.5px] font-bold border ${
      active ? 'bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface border-transparent' : 'glass-chip border-transparent hover:bg-surface-container/70'
    }`;
  });
  try {
    await loadGridLayer(getState().place.id, layer);
  } catch (err) {
    toast(err.code === 'LAYER_UNAVAILABLE' ? 'This layer is unavailable for the area.' : err.message, 'error');
  }
}

async function paintLayer() {
  const st = getState();
  try {
    const payload = await loadGridLayer(st.place.id, st.gridLayer);
    paintTiles(payload);
  } catch (err) {
    const chip = document.getElementById('layer-loading-chip');
    if (chip) chip.classList.add('hidden');
    toast(err.code === 'LAYER_UNAVAILABLE' ? 'Layer unavailable — showing context data.' : err.message, 'warn');
    paintFromContext();
  }
}

function paintFromContext() {
  const ctx = getState().context;
  if (!ctx || !ctx.heatmap) return;
  paintTiles({ grid: ctx.heatmap.grid, units: ctx.heatmap.units, stats: ctx.heatmap.stats, layer: ctx.heatmap.layer, source: ctx.heatmap.source });
}

let lastCellSelectAt = 0;

function onMapClearSelection() {
  // A polygon click is ALWAYS followed by the map's own click event — ignore
  // the map echo right after a real cell selection; only clear on genuinely
  // empty map clicks.
  if (Date.now() - lastCellSelectAt < 250) return;
  if (selectedTile) selectTile(null, null);
}

function paintTiles(payload) {
  const chip = document.getElementById('layer-loading-chip');
  if (chip) chip.classList.add('hidden');
  const layer = payload.layer || getState().gridLayer || 'temperature';
  const tiles = (payload.grid || []).filter((t) => t.value != null);
  const domain = layerDomain(layer, tiles);
  layerDomainCache = domain;
  renderLayerLegends(layer);
  map.drawGrid(tiles.map((t) => ({ ...t, units: payload.units, layerName: payload.layer })), {
    opacity: layer === 'time_of_measure' ? 0.72 : 0.62,
    // Layer-specific color scale — switching layers visibly changes the grid.
    colorOf: (t) => colorFor(layer, t, domain),
    tooltipOf: (t) => {
      const d = describeTile(layer, t);
      return `<b>${d.main}</b><br><span style="opacity:.75">${d.rows.filter(r => r[0] !== 'Location').map(r => r[1]).join(' · ')}</span>`;
    },
    onClick: (t) => selectTile(t, payload),
  });
  // Clicking empty map area (not a cell) clears the inspector selection.
  // Cell polygons stop propagation, so this only fires on the base map.
  const m = map.get();
  if (m) {
    m.map.off('click', onMapClearSelection);
    m.map.on('click', onMapClearSelection);
  }
  const ctx = getState().context;
  if (ctx && ctx.location) map.focusPlace(ctx.location);
  updateStatsCards(payload.stats, tiles.length, payload.units, layer);
  updateDistribution(payload);
  if (selectedTile) {
    const again = tiles.find((t) => String(t.id) === String(selectedTile.id));
    selectTile(again || null, payload);
  }
}

function selectTile(t, payload) {
  selectedTile = t;
  if (t) lastCellSelectAt = Date.now();
  // Publish the selection so Zoe can answer "inspect this cell" with the
  // actual tile the user clicked.
  setState({ selectedTile: t ? {
    id: t.id, valueC: t.value, tempF: t.f != null ? t.f : null,
    band: t.layer ? t.layer.band : null, units: payload && payload.units ? payload.units : 'celsius',
    center: t.center || null,
  } : null });
  if (infoCardEl) {
    const fresh = tileInspector(t, payload);
    infoCardEl.replaceWith(fresh);
    infoCardEl = fresh;
  }
  if (t) {
    map.highlightTile(t);
  } else {
    map.clearHighlight();
  }
}

function tileInspector(t, payload) {
  if (!t) {
    return card({
      title: 'Cell Inspector', ic: 'crop_free',
      children: emptyState({ ic: 'tap_and_play', title: 'Select a cell', message: 'Click any colored cell on the map to inspect temperature, range and exposure band.' }),
    });
  }
  const layer = (payload && payload.layer) || getState().gridLayer || 'temperature';
  const desc = describeTile(layer, t);
  const source = payload && payload.source ? payload.source : (getState().context.heatmap.source || '—');
  const srcLabel = source === 'therma-demo' || source === 'demo' ? 'THERMA demo data' : source === 'fortyguard' ? 'FortyGuard live data' : source;
  return card({
    title: `Cell ${t.id}`, ic: 'crop_free',
    subtitle: `${LAYERS.find((l) => l.id === layer)?.label || layer} · ${srcLabel}${payload && payload.fetchedAt ? ` · ${clockTime(payload.fetchedAt)}` : ''}`,
    children: el('div', { class: 'flex flex-col gap-2' },
      el('div', { class: 'flex items-center justify-between' },
        el('span', { class: 'kpi-value' }, desc.main),
        t.layer && t.layer.band ? bandChip(t.layer.band, t.layer.color) : null),
      el('div', { class: 'grid grid-cols-2 gap-xs text-[11.5px]' },
        desc.rows.map(([k, v]) => kv(k, v))),
      el('button', {
        class: 'squishy-btn glass-chip rounded-full px-3 py-1.5 text-[11px] font-bold self-start mt-1',
        onclick: () => navigate('location', { param: `${t.center ? t.center.lat + ',' + t.center.lon : ''}` }),
      }, 'Open location detail')),
  });
}

function kv(label, value) {
  return el('div', {},
    el('span', { class: 'block text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, label),
    el('span', { class: 'font-semibold' }, value));
}

function statsGrid(hm) {
  const s = hm.stats || {};
  const host = el('div', { class: 'grid grid-cols-2 gap-xs', dataset: { heatStats: '1' } });
  host.appendChild(statTile({ label: 'Minimum', value: tempF(s.min), sub: hm.units === 'hour' ? 'lowest hours' : 'coolest cell', ic: 'south' }));
  host.appendChild(statTile({ label: 'Mean', value: tempF(s.mean), sub: 'area average', ic: 'device_thermostat' }));
  host.appendChild(statTile({ label: 'Maximum', value: tempF(s.max), sub: 'hottest reading', ic: 'north' }));
  host.appendChild(statTile({ label: 'Cells', value: num(s.n), sub: hm.fetchedAt ? `updated ${clockTime(hm.fetchedAt)}` : '', ic: 'grid_on' }));
  return host;
}

function updateStatsCards(stats, n, units, layer) {
  const ly = layer || getState().gridLayer || 'temperature';
  const fmt = (v, sub) => ({ value: ly === 'temperature' ? tempF(v) : ly === 'time_of_measure' ? describeTile(ly, { value: v }).main : `${Number(v).toFixed(1)}h`, sub });
  document.querySelectorAll('[data-heat-stats]').forEach((host) => {
    host.innerHTML = '';
    host.appendChild(statTile({ label: 'Minimum', ...fmt(stats.min, ly === 'temperature' ? 'coolest cell' : 'lowest value'), ic: 'south' }));
    host.appendChild(statTile({ label: 'Mean', ...fmt(stats.mean, 'area average'), ic: 'device_thermostat' }));
    host.appendChild(statTile({ label: 'Maximum', ...fmt(stats.max, ly === 'temperature' ? 'peak reading' : 'highest value'), ic: 'north' }));
    host.appendChild(statTile({ label: 'Cells', value: num(n), sub: '', ic: 'grid_on' }));
  });
}

function distributionCard(hm) {
  const freq = hm.distribution && hm.distribution.frequency;
  return card({
    title: 'Temperature Distribution', ic: 'bar_chart',
    subtitle: 'FortyGuard frequency data',
    children: freq && freq.axis && freq.axis.length
      ? distributionArea({ axis: freq.axis, counts: freq.counts })
      : emptyState({ ic: 'no_sim', title: 'No distribution payload', message: 'This layer does not include a frequency histogram.' }),
  });
}

function updateDistribution() {
  // Distribution histogram comes only from the context payload (temperature
  // layer); the card rendered at build time stays valid across layers.
}
