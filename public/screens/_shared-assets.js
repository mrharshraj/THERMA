// Shared asset-view building blocks used by Portfolio / Urban / Facilities / Risk screens.
// (Not a routed screen.)

import { el, icon, statTile, bandChip, tempF } from '../app/widgets.js';
import { donut, barChart } from '../app/charts.js';
import { navigate } from '../app/router.js';

export const BAND_COLORS = {
  Minimal: '#57b1ff', Low: '#2b7de9', Moderate: '#57b1ff', Elevated: '#fed7aa',
  Warm: '#fed7aa', High: '#f97316', Hot: '#f97316', Critical: '#b91c1c', Extreme: '#b91c1c',
};

export function bandColor(band) {
  return BAND_COLORS[band] || '#f97316';
}

export const RANK = { Minimal: 0, Low: 0, Moderate: 1, Mild: 1, Elevated: 2, Warm: 2, High: 3, Hot: 3, Critical: 4, Extreme: 4 };

export function sortedByRisk(assets) {
  return [...(assets || [])].filter((a) => a.risk)
    .sort((a, b) => b.risk.index - a.risk.index || (b.tempC || 0) - (a.tempC || 0));
}

export function assetCard(a, { onClick, selected = false, showCategory = true } = {}) {
  const color = a.risk ? bandColor(a.risk.band) : '#747878';
  return el('button', {
    class: `squishy-btn glass-panel rounded-2xl p-3 text-left hover-lift w-full ${selected ? 'ring-2 ring-orange-500/70' : ''}`,
    onclick: onClick || (() => navigate('location', { param: `asset:${a.id}` })),
    'aria-label': `${a.name} details`,
  },
  el('div', { class: 'flex items-start justify-between gap-2' },
    el('span', { class: 'min-w-0' },
      el('span', { class: 'block text-[13px] font-bold truncate' }, a.name),
      showCategory ? el('span', { class: 'block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/65 mt-0.5' }, a.category) : null),
    a.risk ? bandChip(a.risk.band, color) : null),
  el('div', { class: 'flex items-center gap-sm mt-2' },
    el('span', { class: 'text-[17px] font-black tracking-tight' }, a.tempF != null ? `${Math.round(a.tempF)}°F` : '—'),
    el('span', { class: 'text-[10px] text-on-surface-variant/75 leading-tight' }, 'est. surface\nat asset'),
    el('span', { class: 'ml-auto flex items-center gap-1 text-[10.5px] font-bold text-on-surface-variant' }, 'Details', icon('north_east', 'text-[12px]', false))),
  a.risk ? riskBar(a.risk.index, color) : null);
}

export function riskBar(index, color) {
  return el('div', { class: 'mt-2 flex gap-1' },
    [1, 2, 3, 4, 5].map((i) => el('span', {
      class: 'h-1.5 flex-1 rounded-full',
      style: { background: i <= index ? color : 'rgba(116,120,120,.25)' },
    })));
}

export function bandDonut(assets) {
  const counts = {};
  for (const a of assets) {
    if (!a.risk) continue;
    counts[a.risk.band] = (counts[a.risk.band] || 0) + 1;
  }
  const order = ['Minimal', 'Low', 'Moderate', 'Elevated', 'Warm', 'High', 'Hot', 'Critical', 'Extreme'];
  const segments = order.filter((b) => counts[b]).map((b) => ({ label: b, value: counts[b], color: BAND_COLORS[b] }));
  if (!segments.length) return null;
  return donut({
    segments,
    centerLabel: String(assets.filter((a) => a.risk).length),
    centerSub: 'assets',
  });
}

export function topExposureBars(assets, n = 6) {
  const top = sortedByRisk(assets).slice(0, n);
  if (!top.length) return null;
  return barChart({
    items: top.map((a) => ({ label: a.name, value: Math.round(a.tempF), color: bandColor(a.risk.band) })),
    fmt: (v) => `${v}°F`,
  });
}

export function kpiStripForAssets(assets) {
  const ranked = sortedByRisk(assets);
  const critical = ranked.filter((a) => a.risk.index >= 4).length;
  const hot = ranked.length ? ranked[0] : null;
  const avgTemp = ranked.length ? ranked.reduce((s, a) => s + a.tempF, 0) / ranked.length : null;
  return el('div', { class: 'grid gap-xs mb-md', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } },
    statTile({ label: 'Assets Tracked', value: String(assets.length), sub: 'curated Miami network', ic: 'domain' }),
    statTile({ label: 'High / Critical', value: String(critical), sub: critical ? 'need mitigation review' : 'none currently', ic: 'warning' }),
    statTile({ label: 'Hottest Asset', value: hot ? `${Math.round(hot.tempF)}°F` : '—', sub: hot ? hot.name : '', ic: 'local_fire_department' }),
    statTile({ label: 'Network Avg', value: avgTemp != null ? `${Math.round(avgTemp)}°F` : '—', sub: 'estimated surface', ic: 'device_thermostat' }));
}
