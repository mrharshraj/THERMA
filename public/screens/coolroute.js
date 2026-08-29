// CoolRoute — thermal route analysis screen (coolroute_navigation).
// Layout: LEFT route parameters · CENTER large interactive map · RIGHT route
// alternatives + thermal intelligence. Mobile: parameters → map → results.

import { getState, setState } from '../app/store.js';
import { getRoutes, geoSearch } from '../app/api.js';
import { getPlaces } from '../app/placepick.js';
import { el, icon, pageHeader, card, statTile, bandChip, sourceBadge, severityChip, km, mins, tempF, loadingState, errorState, emptyState, btnPrimary, btnGhost, toast } from '../app/widgets.js';
import * as map from '../app/map.js';
import { screenEvent } from '../app/router.js';
import { barChart, comparisonBars } from '../app/charts.js';

let form = { from: 'Downtown Miami', to: 'Little Havana', mode: 'driving' };
let fromPlace = null;   // structured { display, lat, lon } once resolved
let toPlace = null;
let selectedId = null;

export default {
  title: 'CoolRoute',
  layout: 'fixed',   // viewport-locked map workspace; below lg the page scrolls
  async render(container) {
    const st = getState();
    const ctx = st.context;
    const routesResp = st.routes;

    container.appendChild(pageHeader({
      eyebrow: 'THERMAL ROUTING',
      title: 'CoolRoute',
      subtitle: `Compare route alternatives by travel time <b>and</b> heat exposure. Thermal association is a THERMA analysis over FortyGuard data near the corridor.`,
      badge: routesResp ? (routesResp.demoEvaluation ? sourceBadge('demo', true) : sourceBadge('fortyguard', false)) : null,
      actions: [btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Compare my route options' })))],
    }));

    // ---- Workspace: params | map | intelligence ----
    // At lg the sidebar leaves ~560px of content, so params + rail stack in a
    // left column beside a full-height map; at xl+ the classic three columns
    // apply. Mobile stacks params -> map -> results.
    const body = el('div', {
      class: "grid gap-md flex-1 min-h-0 grid-cols-1 " +
        // lg (1024, ~560px content): params + rail share the left column
        "lg:[grid-template-areas:'params_map'_'rail_map'] lg:[grid-template-columns:300px_minmax(0,1fr)] lg:[grid-template-rows:auto_minmax(0,1fr)] " +
        // xl (1280+): params left, DOMINANT map top, intelligence rail below it
        "xl:[grid-template-areas:'params_map'_'params_rail'] xl:[grid-template-columns:300px_minmax(0,1fr)] xl:[grid-template-rows:minmax(400px,1.25fr)_minmax(200px,1fr)] " +
        // 2xl (1536+): classic three columns
        "2xl:[grid-template-areas:'params_map_rail'] 2xl:[grid-template-columns:320px_minmax(0,1fr)_340px] 2xl:[grid-template-rows:minmax(0,1fr)]",
    });

    const leftCol = el('div', { class: 'flex flex-col gap-md min-w-0 lg:[grid-area:params]' });
    const mapCol = el('div', { class: 'flex flex-col gap-md min-w-0 min-h-[380px] lg:min-h-0 lg:[grid-area:map]' });
    const rail = el('div', { class: 'flex flex-col gap-md min-w-0 lg:[grid-area:rail] lg:overflow-y-auto pr-1', dataset: { coolrouteRail: '' } });

    // ---------- LEFT: control panel ----------
    leftCol.appendChild(paramsCard());

    // ---------- CENTER: large interactive map ----------
    const mapWrap = el('div', { class: 'relative flex-1 rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 bg-surface-container-low min-h-[380px]' });
    mapWrap.appendChild(el('div', { class: 'absolute top-3 right-3 z-[500] flex flex-col gap-1.5' },
      mapCtrlBtn('my_location', 'Locate me', () => map.locateMe()),
      mapCtrlBtn('refresh', 'Reset view', () => map.resetView()),
      mapCtrlBtn('fullscreen', 'Fullscreen', () => map.toggleFullscreen(mapWrap))));
    if (!routesResp) {
      const empty = emptyState({ ic: 'route', title: 'No analysis yet', message: 'Enter an origin and destination, then Analyze Routes to compare alternatives.' });
      empty.dataset.routeEmpty = '';
      mapWrap.appendChild(empty);
    }
    mapCol.appendChild(mapWrap);

    // ---------- RIGHT: rail placeholder (populated by paintResults) ----------
    rail.appendChild(el('div', { dataset: { railHost: '' } }));

    body.appendChild(leftCol);
    body.appendChild(mapCol);
    body.appendChild(rail);
    container.appendChild(body);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      if (routesResp) paintResults(routesResp);
      else if (ctx && ctx.location) map.focusPlace(ctx.location);
    });

    // Zoe's run_route_analysis action can re-trigger analysis on this screen.
    screenEvent(window, 'therma:run-routes', () => runAnalysis(container));
  },
};

// ---------------------------------------------------------------------------
// Route parameters with predictive location search
// ---------------------------------------------------------------------------

function paramsCard() {
  const fromSearch = placeSearchInput({
    label: 'From',
    initial: form.from,
    onSelect: (p) => { fromPlace = p; form.from = p.display; },
    onChange: (text) => { form.from = text; fromPlace = null; },
  });
  const toSearch = placeSearchInput({
    label: 'To',
    initial: form.to,
    onSelect: (p) => { toPlace = p; form.to = p.display; },
    onChange: (text) => { form.to = text; toPlace = null; },
  });

  const modeSelect = el('select', { class: 'field-input !py-2', 'aria-label': 'Travel mode' },
    ['driving', 'cycling', 'walking'].map((m) => el('option', { value: m, selected: form.mode === m ? '' : null }, m.toUpperCase())));

  const analyzeBtn = btnPrimary('Analyze Routes', 'route', () => runAnalysis(document.getElementById('screen')));

  const swapBtn = el('button', {
    class: 'squishy-btn glass-chip rounded-full w-9 h-9 flex items-center justify-center shrink-0 self-end',
    title: 'Swap origin and destination',
    onclick: () => {
      const t = form.from; form.from = form.to; form.to = t;
      const tp = fromPlace; fromPlace = toPlace; toPlace = tp;
      const screen = document.getElementById('screen');
      const hosts = screen.querySelectorAll('[data-search-input]');
      if (hosts.length === 2) {
        const a = hosts[0].querySelector('input'); const b = hosts[1].querySelector('input');
        const tmp = a.value; a.value = b.value; b.value = tmp;
      }
    },
  }, icon('swap_vert', 'text-[18px]', false));

  return card({
    title: 'Route Parameters', ic: 'tune',
    children: el('div', { class: 'flex flex-col gap-sm' },
      fromSearch,
      toSearch,
      el('div', { class: 'flex items-end gap-xs' },
        el('div', { class: 'flex-1 min-w-0' },
          el('label', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1' }, 'Mode'),
          modeSelect),
        swapBtn),
      analyzeBtn,
      el('span', { class: 'text-[11px] text-on-surface-variant/75' }, 'Origin/destination accept predictions, curated places or lat,lon pairs.')),
  });
}

// Predictive location input: debounced /api/geo/search dropdown. Selecting a
// suggestion stores the STRUCTURED place (name + coordinates + context); the
// analysis request then uses real coordinates instead of raw text.
function placeSearchInput({ label, initial, onSelect, onChange }) {
  const input = el('input', {
    class: 'field-input', placeholder: 'Search place or lat,lon…', 'aria-label': label,
    autocomplete: 'off', value: initial || '',
  });
  const listHost = el('div', { class: 'hidden absolute left-0 right-0 mt-1 z-30 glass-panel rounded-xl p-1 max-h-64 overflow-y-auto' });
  const wrap = el('div', { class: 'relative', dataset: { searchInput: '' } },
    el('label', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 block mb-1' }, label),
    input, listHost);

  let timer = null;
  let seq = 0;
  const closeList = () => listHost.classList.add('hidden');
  const renderList = (results, q) => {
    listHost.innerHTML = '';
    listHost.classList.remove('hidden');
    if (!results.length) {
      listHost.appendChild(el('p', { class: 'px-2.5 py-2 text-[11.5px] text-on-surface-variant/80' }, `No prediction for “${q}” — you can still analyze the raw text or use lat,lon.`));
      return;
    }
    for (const p of results.slice(0, 7)) {
      listHost.appendChild(el('button', {
        type: 'button',
        class: 'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-surface-container/80',
        // pointerdown fires BEFORE the input's blur — selection can never be
        // cancelled by the dropdown hiding itself mid-click.
        onpointerdown: (e) => {
          e.preventDefault();
          input.value = p.display;
          onSelect({ display: p.display, lat: p.lat, lon: p.lon, county: p.county || null });
          closeList();
        },
      },
      icon('location_on', 'text-[15px] text-on-surface-variant/70 shrink-0', false),
      el('span', { class: 'min-w-0 flex-1' },
        el('span', { class: 'block text-[12px] font-bold truncate' }, p.display),
        el('span', { class: 'block text-[10px] text-on-surface-variant/75 truncate' },
          `${p.county ? p.county + ' · ' : ''}${Number(p.lat).toFixed(3)}, ${Number(p.lon).toFixed(3)}`))));
    }
  };

  input.addEventListener('input', () => {
    onChange(input.value);
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { closeList(); return; }
    timer = setTimeout(async () => {
      const mySeq = ++seq;
      try {
        // curated places first (instant), then the live geo search
        const places = await getPlaces();
        const local = places.filter((p) => `${p.name} ${p.display} ${p.county || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 4);
        const res = await geoSearch(q);
        if (mySeq !== seq) return;   // stale prediction
        const merged = [...local];
        for (const p of (res.results || [])) {
          if (!merged.some((m) => m.display === p.display)) merged.push(p);
        }
        renderList(merged.slice(0, 8), q);
      } catch {
        if (mySeq === seq) renderList([], q);
      }
    }, 280);
  });
  input.addEventListener('blur', () => setTimeout(closeList, 180));
  input.addEventListener('focus', () => { if (listHost.children.length) listHost.classList.remove('hidden'); });
  return wrap;
}

function mapCtrlBtn(icName, title, onClick) {
  return el('button', { class: 'map-ctrl', title, 'aria-label': title, onclick: onClick }, icon(icName, 'text-[18px]', false));
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

async function resolvePoint(text, structured) {
  if (structured && structured.lat != null && structured.lon != null) {
    return { lat: structured.lat, lon: structured.lon };
  }
  const raw = String(text || '').trim();
  if (!raw) throw Object.assign(new Error('Enter both an origin and destination.'), { code: 'INVALID_ROUTE_POINTS' });
  const m = raw.split(',').map((x) => parseFloat(x.trim()));
  if (m.length === 2 && !isNaN(m[0]) && !isNaN(m[1]) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) {
    return { lat: m[0], lon: m[1] };
  }
  const places = await getPlaces();
  const hit = places.find((p) => p.display.toLowerCase() === raw.toLowerCase())
    || places.find((p) => `${p.name} ${p.display}`.toLowerCase().includes(raw.toLowerCase()));
  if (hit) return { lat: hit.lat, lon: hit.lon };
  const res = await geoSearch(raw);
  if (res.results && res.results.length) return { lat: res.results[0].lat, lon: res.results[0].lon };
  throw Object.assign(new Error(`“${raw}” could not be resolved to a location.`), { code: 'INVALID_ROUTE_POINTS' });
}

async function runAnalysis(container) {
  const hosts = container.querySelectorAll('[data-search-input]');
  const fromInput = hosts[0] ? hosts[0].querySelector('input') : null;
  const toInput = hosts[1] ? hosts[1].querySelector('input') : null;
  const modeSelect = container.querySelector('select[aria-label="Travel mode"]');
  if (!fromInput || !toInput) return;
  form = { from: fromInput.value, to: toInput.value, mode: modeSelect.value };
  setState({ routesLoading: true, routesError: null });

  try {
    const from = await resolvePoint(form.from, fromPlace);
    const to = await resolvePoint(form.to, toPlace);
    toast(`Analyzing ${form.mode} routes and thermal exposure…`);
    const resp = await getRoutes({ from, to, mode: form.mode });
    setState({ routes: resp, routesLoading: false, selectedRouteId: null });
    selectedId = null;
    paintResults(resp);
    toast(`${resp.routes.length} route${resp.routes.length === 1 ? '' : 's'} analyzed.`, 'success');
  } catch (err) {
    setState({ routesLoading: false, routesError: err });
    toast(err.message || 'Route analysis failed.', 'error');
    paintError(err);
  }
}

function railHost() {
  return document.querySelector('[data-coolroute-rail]');
}

function paintError(err) {
  const host = railHost();
  if (!host) return;
  host.innerHTML = '';
  const invalid = err.code === 'ROUTE_INVALID';
  host.appendChild(errorState({
    title: invalid
      ? 'Route unavailable for this corridor.'
      : err.code === 'NO_ROUTE' ? 'No route found between the selected points.' : 'Route analysis unavailable.',
    err,
    retry: () => {
      const screen = document.getElementById('screen');
      import('./coolroute.js').then((m) => { screen.innerHTML = ''; m.default.render(screen, {}); });
    },
  }));
}

const RANK = { Low: 0, Moderate: 1, Elevated: 2, High: 3, Critical: 4 };

function labelFor(route, all) {
  if (route.label && !/^route-/.test(route.label)) return route.label.toUpperCase();
  if (all.length >= 3) return ['FASTEST', 'BALANCED', 'LOWER HEAT'][all.indexOf(route)] || 'ALTERNATIVE';
  if (all.length === 2) return all.indexOf(route) === 0 ? 'FASTEST' : 'ALTERNATIVE';
  return String(route.id).replace('route-', 'ROUTE ').toUpperCase();
}

function googleMapsUrl(resp, mode) {
  const from = resp.from, to = resp.to;
  const m = { driving: 'driving', cycling: 'bicycling', walking: 'walking' }[mode || 'driving'] || 'driving';
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&travelmode=${m}`;
}

function paintResults(resp) {
  const routes = resp.routes;
  if (!selectedId) {
    const withExp = routes.filter((r) => r.exposure);
    selectedId = withExp.length
      ? withExp.sort((a, b) => (RANK[a.exposure.band] || 0) - (RANK[b.exposure.band] || 0))[0].id
      : routes[0].id;
  }

  const railEl = railHost();
  if (!railEl) return;
  railEl.innerHTML = '';

  railEl.appendChild(el('p', { class: 'text-[11px] font-black uppercase tracking-[0.14em] text-on-surface-variant/70 break-words' },
    `${resp.from.name || 'Origin'} → ${resp.to.name || 'Destination'} · ${resp.mode.toUpperCase()}`));

  // option cards — exactly as many as the backend returned
  for (const r of routes) {
    railEl.appendChild(routeCard(r, resp));
  }

  const sel = routes.find((r) => r.id === selectedId);
  if (sel) railEl.appendChild(detailCard(sel, resp));
  railEl.appendChild(reasoningCard(sel, resp));
  railEl.appendChild(comparisonCard(resp));

  // ---- map ----
  // The boot-time "No analysis yet" placeholder must not sit over the drawn
  // routes once an analysis lands.
  document.querySelectorAll('[data-route-empty]').forEach((n) => n.remove());
  map.drawRoutes(routes, selectedId, {
    endpoints: { from: resp.from, to: resp.to },
    onSelect: (id) => {
      selectedId = id;
      setState({ selectedRouteId: id });
      paintResults(resp);
    },
  });
}

function routeCard(r, resp) {
  const active = r.id === selectedId;
  const exp = r.exposure;
  return el('button', {
    class: `squishy-btn glass-panel rounded-2xl p-3 text-left hover-lift ${active ? 'ring-2 ring-primary' : ''}`,
    role: 'listitem',
    onclick: () => {
      selectedId = r.id;
      setState({ selectedRouteId: r.id });
      paintResults(resp);
    },
  },
  el('div', { class: 'flex items-center justify-between gap-2 mb-1.5' },
    el('span', { class: 'flex items-center gap-1.5 text-[11px] font-black tracking-wide' },
      icon(active ? 'radio_button_checked' : 'radio_button_unchecked', 'text-[15px]', active),
      labelFor(r, resp.routes)),
    exp ? bandChip(exp.band, bandColor(exp.band)) : el('span', { class: 'text-[10px] font-bold text-on-surface-variant/60' }, 'no thermal data')),
  el('div', { class: 'flex flex-wrap items-center gap-x-sm gap-y-0.5 text-[12px]' },
    el('span', { class: 'flex items-center gap-1 font-bold' }, icon('schedule', 'text-[14px] opacity-60', false), mins(r.durationSeconds)),
    el('span', { class: 'flex items-center gap-1 font-bold' }, icon('straighten', 'text-[14px] opacity-60', false), km(r.distanceMeters)),
    exp ? el('span', { class: 'ml-auto font-black', style: { color: bandColor(exp.band) } }, `${Math.round(exp.meanF)}°F avg`) : null),
  exp && exp.score != null ? exposureBar(exp.score) : null);
}

function exposureBar(score) {
  return el('div', { class: 'mt-2 h-1.5 rounded-full overflow-hidden bg-surface-container-highest/60' },
    el('div', { class: 'h-full rounded-full', style: { width: `${score}%`, background: score >= 75 ? '#b91c1c' : score >= 50 ? '#f97316' : '#57b1ff' } }));
}

function bandColor(band) {
  return { Cool: '#2b7de9', Mild: '#57b1ff', Warm: '#ea580c', Hot: '#f97316', Extreme: '#b91c1c' }[band] || '#f97316';
}

function detailCard(r, resp) {
  const exp = r.exposure || {};
  const peak = exp.peakSegment;
  return card({
    title: `${labelFor(r, resp.routes)} — Details`, ic: 'insights',
    actions: [el('a', {
      class: 'squishy-btn glass-chip rounded-full px-3 py-1.5 text-[10.5px] font-bold inline-flex items-center gap-1.5 no-underline',
      href: googleMapsUrl(resp, resp.mode), target: '_blank', rel: 'noopener',
      title: 'Open this route in Google Maps',
    }, icon('open_in_new', 'text-[13px]', false), 'Google Maps')],
    children: el('div', { class: 'flex flex-col gap-2.5' },
      el('div', { class: 'grid grid-cols-3 gap-xs min-w-0' },
        statTile({ label: 'ETA', value: mins(r.durationSeconds), sub: resp.mode.toUpperCase() }),
        statTile({ label: 'Distance', value: km(r.distanceMeters) }),
        statTile({ label: 'Avg exposure', value: exp.meanF != null ? `${Math.round(exp.meanF)}°F` : '—', sub: exp.band || '' })),
      el('div', { class: 'grid grid-cols-2 gap-xs text-[11.5px]' },
        kv('Min / Max', exp.minF != null ? `${Math.round(exp.minF)} – ${Math.round(exp.maxF)}°F` : '—'),
        kv('Exposure score', exp.score != null ? `${exp.score}/100` : '—'),
        kv('Coverage', `${Math.round((r.coverage ?? 0) * 100)}% of samples`),
        kv('Sampled points', exp.sampledPoints != null ? String(exp.sampledPoints) : '—')),
      peak ? el('div', { class: 'glass-chip rounded-xl p-2.5' },
        el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1' }, 'Peak exposure segment'),
        el('div', { class: 'flex items-center justify-between' },
          el('span', { class: 'text-[12px] font-bold' }, `Segment ${peak.index + 1}`),
          el('span', { class: 'text-[12px] font-black', style: { color: bandColor(peak.exposure.band) } },
            `${Number(peak.avgF).toFixed(0)}°F · ${peak.exposure.band}`))) : null,
      el('div', { class: 'flex items-center gap-xs flex-wrap pt-1 border-t border-outline-variant/20' },
        el('a', {
          class: 'squishy-btn bg-primary text-on-primary rounded-full px-3.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 no-underline',
          href: googleMapsUrl(resp, resp.mode), target: '_blank', rel: 'noopener',
        }, icon('map', 'text-[14px]', false), 'Open in Google Maps'),
        el('button', {
          class: 'squishy-btn glass-chip rounded-full px-3 py-1.5 text-[11px] font-bold',
          onclick: () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: `Why is the ${labelFor(r, resp.routes).toLowerCase()} route a good choice?` })),
        }, 'Ask Zoe about this route'))),
  });
}

// RECOMMENDED ROUTE + WHY — every bullet derived from the actual route payload.
function reasoningCard(sel, resp) {
  const routes = resp.routes || [];
  if (!sel || !routes.length) return el('div', {});
  const withExp = routes.filter((r) => r.exposure);
  const exp = sel.exposure;
  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const bullets = [];

  if (exp && withExp.length >= 2) {
    const hottest = [...withExp].sort((a, b) => b.exposure.meanF - a.exposure.meanF)[0];
    if (sel.id === fastest.id && hottest.id !== sel.id) {
      bullets.push(`Fastest option — saves ${Math.round((hottest.durationSeconds - sel.durationSeconds) / 60)} min vs ${labelFor(hottest, routes)}`);
      const dF = hottest.exposure.meanF - exp.meanF;
      if (dF > 0.2) bullets.push(`but runs ${dF.toFixed(1)}°F warmer on average — highest exposure of the set`);
    } else if (sel.id !== fastest.id) {
      const dMin = Math.round((sel.durationSeconds - fastest.durationSeconds) / 60);
      bullets.push(`${dMin > 0 ? '+' + dMin + ' min' : Math.abs(dMin) + ' min faster'} vs ${labelFor(fastest, routes)}`);
      if (fastest.exposure) {
        const dF = fastest.exposure.meanF - exp.meanF;
        const pct = fastest.exposure.score ? Math.round(((fastest.exposure.score - exp.score) / fastest.exposure.score) * 100) : null;
        if (dF > 0.2) bullets.push(`−${dF.toFixed(1)}°F average thermal exposure${pct > 0 ? ` (≈${pct}% lower exposure score)` : ''}`);
      }
      const worstPeak = withExp.map((r) => r.exposure.peakSegment).filter(Boolean)
        .sort((a, b) => (RANK[b.exposure.band] || 0) - (RANK[a.exposure.band] || 0))[0];
      if (worstPeak && sel.exposure.peakSegment && RANK[sel.exposure.peakSegment.exposure.band] < RANK[worstPeak.exposure.band]) {
        bullets.push(`avoids the corridor's highest-exposure segment (${worstPeak.exposure.band}, segment ${worstPeak.index + 1})`);
      }
    }
    if (exp.peakSegment) bullets.push(`peak exposure on segment ${exp.peakSegment.index + 1} (${Number(exp.peakSegment.avgF).toFixed(0)}°F · ${exp.peakSegment.exposure.band})`);
    if (sel.coverage != null) bullets.push(`${Math.round(sel.coverage * 100)}% thermal coverage · ${exp.sampledPoints || 0} sampled points`);
  } else {
    bullets.push('Thermal association unavailable for this corridor — compare on time and distance only.');
  }

  return card({
    title: 'Recommended Route', ic: 'psychology',
    subtitle: 'Thermal reasoning from the analyzed payload',
    children: el('div', { class: 'flex flex-col gap-xs' },
      el('div', { class: 'flex items-center gap-sm' },
        el('span', { class: 'text-[15px] font-black' }, labelFor(sel, routes)),
        severityChip(sel.exposure ? `${Math.round((sel.durationSeconds / 60))} min · ${Math.round(sel.exposure.meanF)}°F` : `${Math.round(sel.durationSeconds / 60)} min`)),
      el('ul', { class: 'flex flex-col gap-1 m-0 p-0 list-none' },
        bullets.map((b) => el('li', { class: 'text-[11.5px] text-on-surface-variant/90 flex gap-1.5' },
          el('span', { class: 'opacity-60 shrink-0' }, '•'), b)))),
  });
}

// COOLEST vs FASTEST — the core THERMA differentiator, from real numbers.
function comparisonCard(resp) {
  const routes = resp.routes || [];
  const withExp = routes.filter((r) => r.exposure);
  if (withExp.length < 2) return el('div', {});

  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const coolest = [...withExp].sort((a, b) => a.exposure.meanF - b.exposure.meanF)[0];
  if (fastest.id === coolest.id) {
    const alt = withExp.find((r) => r.id !== fastest.id);
    if (!alt) return el('div', {});
  }

  const dMin = Math.round((coolest.durationSeconds - fastest.durationSeconds) / 60);
  const dF = (fastest.exposure ? fastest.exposure.meanF : 0) - coolest.exposure.meanF;
  const pct = fastest.exposure && fastest.exposure.score
    ? Math.round(((fastest.exposure.score - coolest.exposure.score) / fastest.exposure.score) * 100)
    : null;
  const peakAvoided = fastest.exposure && fastest.exposure.peakSegment && coolest.exposure.peakSegment
    && RANK[coolest.exposure.peakSegment.exposure.band] < RANK[fastest.exposure.peakSegment.exposure.band];

  const chips = [
    `${dMin >= 0 ? '+' + dMin : dMin} min`,
    dF > 0 ? `−${dF.toFixed(1)}°F avg exposure` : 'similar avg exposure',
    pct > 0 ? `−${pct}% exposure score` : null,
    peakAvoided ? 'avoids peak segment' : null,
  ].filter(Boolean);

  return card({
    title: `${labelFor(coolest, routes)} vs ${labelFor(fastest, routes)}`, ic: 'compare_arrows',
    subtitle: 'Computed from the analyzed alternatives',
    children: el('div', { class: 'flex flex-col gap-sm' },
      el('div', { class: 'flex flex-wrap gap-1.5' },
        chips.map((c) => el('span', { class: 'glass-chip rounded-full px-2.5 py-1 text-[11px] font-bold' }, c))),
      comparisonBars({
        groups: withExp.map((r) => ({
          label: labelFor(r, routes),
          values: [Math.round(r.exposure.meanF * 10) / 10, Math.round(r.durationSeconds / 60)],
        })),
        seriesNames: ['Mean °F', 'Minutes'],
        colors: ['#f97316', '#8a8a8a'],
      })),
  });
}

function kv(label, value) {
  return el('div', {},
    el('span', { class: 'block text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, label),
    el('span', { class: 'font-semibold' }, value));
}
