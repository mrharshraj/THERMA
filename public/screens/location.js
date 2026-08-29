// Location / Asset detail — resolves route param to an asset or a place.

import { getState } from '../app/store.js';
import { geoSearch, geoReverse, loadContextFor } from '../app/api.js';
import { getPlaces } from '../app/placepick.js';
import { el, icon, pageHeader, card, statTile, emptyState, loadingState, errorState, sourceBadge, severityChip, bandChip, btnPrimary, btnGhost, toast, timeAgo, num, bothTemps, tempF } from '../app/widgets.js';
import { distributionArea } from '../app/charts.js';
import { navigate } from '../app/router.js';
import { sortedByRisk, BAND_COLORS } from './_shared-assets.js';

export default {
  title: 'Location',
  async render(container, route) {
    const param = decodeURIComponent(route.param || '');
    const st = getState();

    // 1) Asset profile
    if (param.startsWith('asset:')) {
      const id = param.slice(6);
      const asset = (st.context && st.context.assets || []).find((a) => String(a.id) === id);
      if (!asset) {
        container.appendChild(emptyState({
          ic: 'search_off', title: 'Asset not found',
          message: 'This asset is not part of the currently loaded portfolio. Load its parent area first.',
          actions: [btnGhost('Open Explorer', 'explore', () => navigate('explorer'))],
        }));
        return;
      }
      renderAsset(container, asset, st);
      return;
    }

    // 2) Coordinates form
    const coord = parseCoords(param);
    if (coord) return renderResolvedPlace(container, { lat: coord.lat, lon: coord.lon, display: `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`, id: null });

    // 3) Place id
    if (st.context && st.context.location && String(st.context.location.id) === param) {
      return renderResolvedPlace(container, st.context.location);
    }
    container.appendChild(loadingState('Resolving location…'));
    try {
      const places = await getPlaces();
      const hit = (places || []).find((p) => String(p.id) === param || String(p.external || '') === param);
      if (!hit) throw new Error('Unknown location.');
      await loadContextFor(hit.id);
      container.innerHTML = '';
      renderResolvedPlace(container, getState().context.location);
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(errorState({
        title: 'Location unavailable.',
        err,
        retry: () => this.render(container, route),
        onRelocate: () => navigate('search'),
      }));
    }
  },
};

function parseCoords(param) {
  const m = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/.exec(param);
  return m ? { lat: parseFloat(m[1]), lon: parseFloat(m[2]) } : null;
}

// ---------------------------------------------------------------- asset view
function renderAsset(container, asset, st) {
  const risk = asset.risk || {};
  const band = risk.band || 'Moderate';
  const idx = Number(risk.index || 0);
  const color = BAND_COLORS[band] || '#f59e0b';
  const relatedAlerts = (st.context && st.context.alerts || []).filter((a) => String(a.assetId) === String(asset.id));

  container.appendChild(pageHeader({
    eyebrow: 'ASSET PROFILE',
    title: asset.name,
    subtitle: `${asset.category || 'Asset'} · ${Number(asset.lat).toFixed(4)}, ${Number(asset.lon).toFixed(4)}`,
    actions: [
      btnGhost('Heat Map', 'grid_view', async () => { navigate('heat'); }),
      btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: `What should we do about ${asset.name}?` }))),
    ],
  }));

  container.appendChild(el('div', { class: 'kpi-grid' },
    statTile({ label: 'Surface Reading', value: tempF(asset.tempF), sub: 'satellite thermal capture', ic: 'thermostat' }),
    statTile({ label: 'Air Equivalent', value: bothTemps(asset.tempC), sub: 'celsius baseline', ic: 'device_thermostat' }),
    statTile({ label: 'Risk Index', value: `${num(idx * 20)}%`, sub: 'thermal exposure score', ic: 'speed' }),
    statTile({ label: 'Risk Band', value: band, sub: `${idx.toFixed(1)} of 5`, ic: 'shield' })));

  container.appendChild(el('div', { class: 'grid lg:grid-cols-2 gap-md mt-md' },
    card({
      title: 'Thermal Risk Assessment', ic: 'local_fire_department',
      children: el('div', {}, riskBar(idx, band, color),
        el('div', { class: 'mt-sm text-[11.5px] text-on-surface-variant/85 leading-relaxed' },
          `Index ${idx.toFixed(1)} of 5 · Band ${band}. Values reflect the latest ${getState().demoMode === false ? 'live' : ''} thermal capture for the tile containing this asset.`),
        el('div', { class: 'flex flex-wrap gap-xs mt-sm' }, bandChip(band, color), assetSourceBadge(asset))),
    }),
    card({
      title: 'Recommended Actions', ic: 'tips_and_updates',
      children: relatedAlerts.length
        ? el('div', { class: 'flex flex-col gap-2' }, relatedAlerts.map((a) => alertMini(a)))
        : el('div', { class: 'text-[12px] text-on-surface-variant/80' }, 'No open alerts reference this asset. Re-run analysis after the next thermal refresh to reassess.'),
    })));
}

function riskBar(idx, band, color) {
  return el('div', {},
    el('div', { class: 'h-2.5 rounded-full overflow-hidden bg-surface-container-highest/60' },
      el('div', { class: 'h-full rounded-full transition-all duration-700', style: { width: `${Math.min(100, idx * 20)}%`, background: color } })),
    el('div', { class: 'flex justify-between mt-1 text-[10px] font-bold text-on-surface-variant/70' },
      el('span', {}, 'LOW'), el('span', { style: { color } }, band.toUpperCase()), el('span', {}, 'CRITICAL')));
}

function alertMini(a) {
  return el('button', {
    class: 'glass-chip rounded-xl px-3 py-2 text-left hover-lift',
    onclick: () => navigate('alerts', { query: { highlight: a.id } }),
  },
  el('span', { class: 'flex items-center gap-2' }, severityChip(a.severity), el('span', { class: 'text-[12px] font-bold truncate' }, a.type)),
  el('span', { class: 'block text-[11px] text-on-surface-variant/80 mt-0.5 line-clamp-2' }, a.description || ''),
  el('span', { class: 'block text-[10px] text-on-surface-variant/60 mt-0.5' }, timeAgo(a.time)));
}

// ---------------------------------------------------------------- place view
async function renderResolvedPlace(container, loc) {
  const st = getState();
  if (!st.context || (loc.id && String(st.context.location.id) !== String(loc.id))) {
    try {
      await loadContextFor(loc.id || `${loc.lat},${loc.lon}`);
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(errorState({
        title: 'Location data unavailable.',
        err,
        retry: () => renderResolvedPlace(container, loc),
        onRelocate: () => navigate('search'),
      }));
      return;
    }
  }
  const ctx = getState().context;
  const hm = ctx.heatmap || {};
  const stats = hm.stats || {};
  const exposure = ctx.exposure || {};
  const assets = sortedByRisk(ctx.assets || []);
  const alerts = (ctx.alerts || []);

  container.appendChild(pageHeader({
    eyebrow: 'LOCATION INTELLIGENCE',
    title: loc.display,
    subtitle: `${Number(loc.lat).toFixed(4)}, ${Number(loc.lon).toFixed(4)} · ${hm.layer ? String(hm.layer).replace(/_/g, ' ') : 'thermal'} layer`,
    badge: modeBadge(ctx),
    actions: [
      btnGhost('Open in Heat Intelligence', 'device_thermostat', () => navigate('heat')),
      btnGhost('Compare', 'compare_arrows', () => navigate('workspace', { query: { compare: loc.id } })),
    ],
  }));

  container.appendChild(el('div', { class: 'kpi-grid' },
    statTile({ label: 'Mean Surface', value: tempF(stats.meanF != null ? stats.meanF : f(stats.meanC)), sub: `${stats.n || (hm.grid || []).length} cells analyzed`, ic: 'device_thermostat' }),
    statTile({ label: 'Hottest Cell', value: tempF(stats.maxF != null ? stats.maxF : f(stats.maxC)), sub: 'peak reading', ic: 'local_fire_department' }),
    statTile({ label: 'Coolest Cell', value: tempF(stats.minF != null ? stats.minF : f(stats.minC)), sub: 'lowest reading', ic: 'ac_unit' }),
    statTile({ label: 'Cells Analyzed', value: num(stats.n || (hm.grid || []).length), sub: hm.layer ? String(hm.layer).replace(/_/g, ' ') : 'thermal layer', ic: 'grid_view' })));

  const grid = el('div', { class: 'grid lg:grid-cols-2 gap-md mt-md' });

  grid.appendChild(card({
    title: 'Cell Temperature Distribution', ic: 'bar_chart',
    children: distChart(hm),
  }));

  grid.appendChild(card({
    title: 'Exposure Drivers', ic: 'insights',
    children: exposureCard(exposure),
  }));
  container.appendChild(grid);

  // Assets near this place
  container.appendChild(card({
    title: `Assets & Properties (${assets.length})`, ic: 'apartment',
    subtitle: 'Sorted by thermal risk',
    children: assets.length ? el('div', { class: 'grid md:grid-cols-2 xl:grid-cols-3 gap-xs' },
      assets.map((a) => el('button', {
        class: 'glass-chip rounded-xl px-3 py-2.5 text-left hover-lift',
        onclick: () => navigate('location', { param: `asset:${a.id}` }),
      },
      el('span', { class: 'block text-[12.5px] font-bold truncate' }, a.name),
      el('span', { class: 'flex items-center gap-2 mt-1' },
        el('span', { class: 'text-[11px] text-on-surface-variant/80' }, tempF(a.tempF)),
        bandChip((a.risk && a.risk.band) || 'Moderate'))))) : emptyState({ ic: 'domain', title: 'No cataloged assets here' }),
  }));

  // Alerts for this place
  container.appendChild(card({
    title: `Active Alerts (${alerts.length})`, ic: 'warning',
    children: alerts.length ? el('div', { class: 'flex flex-col gap-1.5' },
      alerts.map(alertMini)) : emptyState({ ic: 'check_circle', title: 'No active alerts', message: 'Conditions are within normal thresholds.' }),
  }));
}

function modeBadge(ctx) {
  const src = String(ctx.source || '').toLowerCase();
  const live = src.includes('forty') || src.includes('live');
  return live ? sourceBadge('live', false) : sourceBadge('demo', !!ctx.demo);
}

function assetSourceBadge(asset) {
  const src = String(asset.source || (getState().context && getState().context.source) || 'demo');
  return sourceBadge(src, src === 'demo' || src === 'therma-demo');
}

function f(c) { return c == null ? null : c * 9 / 5 + 32; }

function distChart(hm) {
  const freq = hm.distribution && hm.distribution.frequency;
  if (!freq || !Array.isArray(freq.counts) || !freq.counts.length) {
    return emptyState({ ic: 'bar_chart', title: 'Distribution unavailable', message: 'Run a fresh analysis for this area.' });
  }
  return distributionArea({ axis: freq.axis, counts: freq.counts });
}

function exposureCard(exp) {
  if (!exp || exp.level == null && !exp.drivers) {
    return emptyState({ ic: 'insights', title: 'No exposure assessment yet' });
  }
  const drivers = Array.isArray(exp.drivers) ? exp.drivers : [];
  return el('div', {},
    el('div', { class: 'flex items-center gap-2 mb-sm' },
      el('span', { class: 'text-[13px] font-black uppercase tracking-wide' }, exp.level || '—'),
      exp.temperature ? el('span', { class: 'text-[11.5px] text-on-surface-variant/80' }, `· feels like ${tempF(f(exp.temperatureC != null ? exp.temperatureC : exp.temperature))}`) : null,
      exp.score != null ? el('span', { class: 'text-[11px] text-on-surface-variant/70 ml-auto' }, `score ${exp.score}`) : null),
    el('div', { class: 'flex flex-wrap gap-1' },
      drivers.map((d) => el('span', { class: 'glass-chip rounded-full px-2.5 py-1 text-[10.5px] font-bold capitalize' }, String(d).replace(/_/g, ' ')))),
    el('p', { class: 'text-[11px] text-on-surface-variant/70 mt-sm' }, 'Drivers combine ambient conditions and captured surface heat for this location.'));
}
