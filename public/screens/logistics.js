// Logistics Operations — dispatch view over thermal routes (logistics_operations).

import { getState } from '../app/store.js';
import { getRoutes, geoSearch } from '../app/api.js';
import { getPlaces } from '../app/placepick.js';
import { el, icon, pageHeader, card, statTile, bandChip, sourceBadge, km, mins, tempF, emptyState, btnPrimary, btnGhost, toast, loadingState } from '../app/widgets.js';
import * as map from '../app/map.js';
import { barChart } from '../app/charts.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

const DEFAULTS = { from: 'Downtown Miami', to: 'Little Havana', mode: 'driving' };
let resp = null;
let selectedId = null;
let busy = false;

export default {
  title: 'Logistics Operations',
  async render(container) {
    const st = getState();
    const ctx = st.context;

    container.appendChild(pageHeader({
      eyebrow: 'DISPATCH INTELLIGENCE',
      title: 'Logistics Operations',
      subtitle: `Operational corridor planning under heat stress. Exposure figures are <b>THERMA analysis</b> along each alternative.`,
      badge: resp ? (resp.demoEvaluation ? sourceBadge('demo', true) : sourceBadge('fortyguard', false)) : null,
      actions: [
        btnGhost('Open CoolRoute Planner', 'route', () => navigate('coolroute')),
        btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Compare my route options' }))),
      ],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'local_shipping', title: 'No operations context', message: 'Load a location first so corridors can be thermally associated.' }));
      return;
    }

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]' });

    // ---------- left: dispatch board ----------
    const board = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    const paramsCard = card({
      title: 'Corridor', ic: 'alt_route',
      children: el('div', { class: 'flex flex-col gap-xs' },
        fieldEl('Origin', DEFAULTS.from, 'lg-origin'),
        fieldEl('Destination', DEFAULTS.to, 'lg-dest'),
        btnPrimary('Run Corridor Analysis', 'radar', () => runAnalysis(board)),
        el('p', { class: 'text-[10.5px] text-on-surface-variant/75 mt-1' }, 'Accepts place names or “lat,lon”. Thermal association uses the nearest monitored heat layer.')),
    });
    board.appendChild(paramsCard);
    board.appendChild(el('div', { dataset: { dispatchResults: '' } },
      emptyState({ ic: 'pending_actions', title: 'Awaiting analysis', message: 'Run the corridor analysis to populate dispatch options.' })));

    // ---------- right: map ----------
    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 bg-surface-container-low min-h-[420px]' });
    mapWrap.appendChild(el('div', { class: 'absolute top-3 right-3 z-[500]' },
      el('button', { class: 'map-ctrl', title: 'Fullscreen', onclick: () => map.toggleFullscreen(mapWrap) }, icon('fullscreen', 'text-[18px]', false))));
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5 hidden', dataset: { lgSource: '' } }));
    grid.appendChild(board);
    grid.appendChild(mapWrap);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      if (ctx.location) map.focusPlace(ctx.location);
    });

    screenEvent(window, 'therma:context', () => {
      if (!document.body.contains(container)) return;
      resp = null;
      rerenderScreen('logistics', container);
    });
  },
};

function fieldEl(label, value, cls) {
  return el('div', {},
    el('label', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1' }, label),
    el('input', { class: `field-input ${cls}`, value, 'aria-label': label }));
}

async function resolvePoint(text) {
  const raw = String(text || '').trim();
  const m = raw.split(',').map(parseFloat);
  if (m.length === 2 && !isNaN(m[0]) && !isNaN(m[1])) return { lat: m[0], lon: m[1] };
  const places = await getPlaces();
  const hit = places.find((p) => p.display.toLowerCase() === raw.toLowerCase())
    || places.find((p) => `${p.name} ${p.display}`.toLowerCase().includes(raw.toLowerCase()));
  if (hit) return { lat: hit.lat, lon: hit.lon };
  const res = await geoSearch(raw);
  if (res.results && res.results.length) return { lat: res.results[0].lat, lon: res.results[0].lon };
  throw Object.assign(new Error(`“${raw}” not found.`), { code: 'INVALID_ROUTE_POINTS' });
}

async function runAnalysis(board) {
  if (busy) return;
  busy = true;
  const origin = document.querySelector('.lg-origin').value;
  const dest = document.querySelector('.lg-dest').value;
  const resultsHost = document.querySelector('[data-dispatch-results]');
  resultsHost.innerHTML = '';
  resultsHost.appendChild(loadingState('Analyzing corridor thermal exposure…'));
  try {
    const from = await resolvePoint(origin);
    const to = await resolvePoint(dest);
    resp = await getRoutes({ from, to, mode: 'driving' });
    selectedId = pickDefault(resp.routes);
    paintBoard(resultsHost);
    paintMap(resp);
  } catch (err) {
    resultsHost.innerHTML = '';
    resultsHost.appendChild(emptyState({ ic: 'error', title: 'Analysis failed', message: err.message || 'Route analysis unavailable.' }));
    toast(err.message || 'Route analysis failed.', 'error');
  } finally {
    busy = false;
  }
}

function pickDefault(routes) {
  const RANK = { Low: 0, Moderate: 1, Elevated: 2, High: 3, Critical: 4 };
  const withExp = routes.filter((r) => r.exposure);
  return withExp.length ? withExp.sort((a, b) => RANK[a.exposure.band] - RANK[b.exposure.band])[0].id : routes[0].id;
}

function labelFor(r) {
  return (r.label && !/^route-/.test(r.label) ? r.label : String(r.id)).toUpperCase();
}

function paintBoard(host) {
  host.innerHTML = '';
  const routes = resp.routes;
  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const coolest = routes.filter((r) => r.exposure).sort((a, b) => a.exposure.meanF - b.exposure.meanF)[0];

  // KPI strip
  host.appendChild(el('div', { class: 'grid grid-cols-2 gap-xs mb-1' },
    statTile({ label: 'Options', value: String(routes.length), sub: 'analyzed alternatives', ic: 'alt_route' }),
    statTile({ label: 'Time Spread', value: `${Math.round(Math.max(...routes.map((r) => r.durationSeconds)) / 60 - Math.min(...routes.map((r) => r.durationSeconds)) / 60)} min`, sub: 'fastest vs slowest', ic: 'timelapse' }),
    statTile({ label: 'Heat Spread', value: coolest ? `${(Math.max(...routes.filter((r) => r.exposure).map((r) => r.exposure.meanF)) - Math.min(...routes.filter((r) => r.exposure).map((r) => r.exposure.meanF))).toFixed(1)}°F` : '—', sub: 'mean-exposure range', ic: 'thermostat' }),
    statTile({ label: 'Recommended', value: coolest ? labelFor(coolest) : '—', sub: 'lowest mean exposure', ic: 'verified' })));

  // trade-off callout
  if (coolest && fastest && coolest.id !== fastest.id && fastest.exposure && coolest.exposure) {
    const dMin = (coolest.durationSeconds - fastest.durationSeconds) / 60;
    const dHeat = fastest.exposure.meanF - coolest.exposure.meanF;
    host.appendChild(el('div', { class: 'glass-panel rounded-2xl p-3 flex items-center gap-sm', style: { background: 'rgba(5,150,105,.08)' } },
      icon('swap_horiz', 'text-[20px] text-green-600'),
      el('p', { class: 'text-[12px] font-semibold' },
        `Trade-off: the coolest option runs ${dHeat > 0 ? dHeat.toFixed(1) + '°F cooler' : 'similar heat'} for ${dMin >= 0 ? '+' + Math.round(dMin) + ' min' : Math.abs(Math.round(dMin)) + ' min faster'} versus the fastest.`)));
  }

  // option rows
  const list = el('div', { class: 'flex flex-col gap-2' });
  for (const r of routes) list.appendChild(optionRow(r));
  host.appendChild(card({ title: 'Dispatch Options', ic: 'format_list_numbered', children: list }));

  // comparison bars
  const withExp = routes.filter((r) => r.exposure);
  if (withExp.length >= 2) {
    host.appendChild(card({
      title: 'Exposure Profile', ic: 'equalizer', subtitle: 'Mean °F per alternative · THERMA analysis',
      children: barChart({
        items: withExp.map((r) => ({ label: labelFor(r), value: Math.round(r.exposure.meanF), color: r.id === selectedId ? '#b91c1c' : '#f97316' })),
        fmt: (v) => `${v}°F`,
      }),
    }));
  }
}

function optionRow(r) {
  const active = r.id === selectedId;
  const exp = r.exposure;
  return el('button', {
    class: `squishy-btn glass-chip rounded-xl p-3 text-left hover-lift w-full ${active ? 'ring-2 ring-orange-500/70' : ''}`,
    onclick: () => { selectedId = r.id; paintBoard(document.querySelector('[data-dispatch-results]')); paintMap(resp); },
  },
  el('div', { class: 'flex items-center justify-between gap-2' },
    el('span', { class: 'flex items-center gap-1.5 text-[11.5px] font-black tracking-wide' },
      icon(active ? 'radio_button_checked' : 'radio_button_unchecked', 'text-[15px]', active), labelFor(r)),
    exp ? bandChip(exp.band, exp.band === 'Extreme' || exp.band === 'Hot' ? '#f97316' : exp.band === 'Critical' ? '#b91c1c' : '#57b1ff') : null),
  el('div', { class: 'flex items-center gap-sm mt-1 text-[11.5px]' },
    el('span', { class: 'font-bold' }, mins(r.durationSeconds)),
    el('span', { class: 'font-bold' }, km(r.distanceMeters)),
    exp ? el('span', { class: 'ml-auto font-black' }, `${Math.round(exp.meanF)}°F avg`) : null));
}

function paintMap(respLocal) {
  map.drawRoutes(respLocal.routes, selectedId, {
    onSelect: (id) => { selectedId = id; paintBoard(document.querySelector('[data-dispatch-results]')); paintMap(resp); },
  });
  if (respLocal.associationPlace) {
    const srcChip = document.querySelector('[data-lg-source]');
    if (srcChip) {
      srcChip.classList.remove('hidden');
      srcChip.innerHTML = '';
      srcChip.appendChild(sourceBadge(respLocal.demoEvaluation ? 'demo' : 'fortyguard', respLocal.demoEvaluation));
    }
  }
}
