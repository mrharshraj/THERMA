// Infrastructure & Utilities (infrastructure_utilities_2) — prioritization
// of energy / water / transit assets under heat stress.

import { getState } from '../app/store.js';
import { el, icon, pageHeader, card, statTile, emptyState, btnGhost, bandChip, tempF } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { sortedByRisk, bandColor, riskBar, topExposureBars } from './_shared-assets.js';
import { flowchart } from '../app/flowchart.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

const INFRA_CATS = ['energy', 'water', 'transit', 'industrial'];

export default {
  title: 'Infrastructure & Utilities',
  async render(container) {
    const st = getState();
    const ctx = st.context;
    const all = ctx ? ctx.assets || [] : [];
    const infra = all.filter((a) => INFRA_CATS.includes(a.category));
    const list = infra.length ? infra : all;
    const ranked = sortedByRisk(list);
    const alerts = ctx ? (ctx.alerts || []).filter((a) => a.category === 'energy' || a.category === 'water' || a.category === 'logistics') : [];

    container.appendChild(pageHeader({
      eyebrow: 'RESILIENCE',
      title: 'Infrastructure & Utilities',
      subtitle: ctx ? `Thermal stress and inspection prioritization for <b>${list.length} infrastructure assets</b>. Rankings are THERMA analysis over FortyGuard data.` : 'Infrastructure heat-stress prioritization.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Facility Analysis', 'factory', () => navigate('facilities')),
        btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'What infrastructure needs inspection first?' }))),
      ],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'bolt', title: 'No infrastructure context', message: 'Load a location to prioritize its utilities.' }));
      return;
    }

    // ---------- KPIs ----------
    const critical = ranked.filter((a) => a.risk.index >= 4).length;
    const gridKpi = el('div', { class: 'grid gap-xs mb-md', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' } },
      statTile({ label: 'Infra Assets', value: String(list.length), sub: INFRA_CATS.join(' · '), ic: 'bolt' }),
      statTile({ label: 'Priority Queue', value: String(critical), sub: critical ? 'high/critical stress' : 'no critical stress', ic: 'priority_high' }),
      statTile({ label: 'Infra Alerts', value: String(alerts.length), sub: alerts.length ? 'active this cycle' : 'all clear', ic: 'notification_important' }),
      statTile({ label: 'Hottest Node', value: ranked[0] ? `${Math.round(ranked[0].tempF)}°F` : '—', sub: ranked[0] ? ranked[0].name : '', ic: 'device_thermostat' }));
    container.appendChild(gridKpi);

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]' });

    // ---------- left ----------
    const left = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    left.appendChild(card({
      title: 'Prioritization Logic', ic: 'account_tree',
      subtitle: 'How THERMA ranks utility inspections',
      children: flowchart({
        steps: [
          { title: 'HEAT LAYER', detail: 'FortyGuard temperature cells around each asset.', icon: 'grid_on', tone: 'data', tag: 'fortyguard data' },
          { title: 'ASSET SAMPLING', detail: 'Nearest-cell surface estimate per asset.', icon: 'my_location', tone: 'method', tag: 'therma analysis' },
          { title: 'STRESS BAND', detail: 'Index ≥ 4 enters the priority queue.', icon: 'speed', tone: 'method' },
          { title: 'DISPATCH WINDOW', detail: 'Inspections scheduled pre-dawn to avoid peak.', icon: 'engineering', tone: 'method' },
          { title: 'VERIFY & REPORT', detail: 'Findings logged into Reports Library.', icon: 'fact_check', tone: 'output', tag: 'act' },
        ],
      }),
    }));

    left.appendChild(card({
      title: 'Top Thermal Stress', ic: 'local_fire_department',
      children: topExposureBars(list, 5) || emptyState({ ic: 'hourglass_empty', title: 'Awaiting heat layer' }),
    }));

    // ---------- right ----------
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 min-h-0 lg:overflow-y-auto pr-1' });

    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[280px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5' }, modeBadgeFor(ctx)));
    right.appendChild(mapWrap);

    right.appendChild(card({
      title: `Priority Queue (${ranked.filter((a) => a.risk && a.risk.index >= 3).length})`, ic: 'low_priority',
      children: ranked.length
        ? el('div', { class: 'flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1' },
          ranked.map((a) => queueRow(a)))
        : emptyState({ ic: 'inbox', title: 'No assets with exposure data' }),
    }));

    if (alerts.length) {
      right.appendChild(card({
        title: `Infra Alerts (${alerts.length})`, ic: 'warning',
        children: el('div', { class: 'flex flex-col gap-1.5' }, alerts.slice(0, 4).map((a) =>
          el('button', {
            class: 'glass-chip rounded-xl p-2.5 text-left hover-lift',
            onclick: () => navigate('alerts', { query: { highlight: a.id } }),
          },
          el('div', { class: 'flex items-center justify-between gap-2 mb-0.5' },
            el('span', { class: 'text-[12px] font-bold truncate' }, a.type),
            el('span', { class: 'text-[9.5px] font-bold uppercase text-on-surface-variant/60' }, a.severity)),
          el('p', { class: 'text-[11px] text-on-surface-variant/90 line-clamp-2' }, a.description))))}));
    }

    grid.appendChild(left);
    grid.appendChild(right);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      for (const a of list) {
        map.addMarker({
          lat: a.lat, lon: a.lon,
          label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
          category: a.category,
          color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
          onClick: () => navigate('location', { param: `asset:${a.id}`, query: { view: 'facility' } }),
        });
      }
      if (ctx.location) map.focusPlace(ctx.location);

    screenEvent(window, 'therma:context', () => rerenderScreen('utilities', container));
    });
  },
};

function queueRow(a) {
  const color = bandColor(a.risk.band);
  return el('div', { class: 'glass-chip rounded-xl p-2.5 flex items-center gap-sm' },
    el('span', { class: 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0', style: { background: `${color}22` } },
      icon('bolt', 'text-[15px]', false)),
    el('span', { class: 'min-w-0 flex-1' },
      el('span', { class: 'block text-[12px] font-bold truncate' }, a.name),
      el('span', { class: 'block text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/65' }, `${a.category} · index ${a.risk.index}/5`)),
    el('span', { class: 'text-right shrink-0' },
      el('span', { class: 'block text-[13px] font-black' }, tempF(a.tempF)),
      bandChip(a.risk.band, color)));
}
