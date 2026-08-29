// Risk & Insurance Asset Intelligence (risk_insurance_asset_intelligence).

import { getState } from '../app/store.js';
import { el, icon, pageHeader, card, statTile, emptyState, btnGhost, bandChip, sourceBadge } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { sortedByRisk, bandColor, bandDonut, kpiStripForAssets, riskBar } from './_shared-assets.js';
import { ringGauge, barChart } from '../app/charts.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

export default {
  title: 'Risk & Insurance',
  async render(container) {
    const st = getState();
    const ctx = st.context;
    const assets = ctx ? ctx.assets || [] : [];
    const ranked = sortedByRisk(assets);
    const avgIndex = ranked.length ? ranked.reduce((s, a) => s + a.risk.index, 0) / ranked.length : null;

    container.appendChild(pageHeader({
      eyebrow: 'UNDERWRITING VIEW',
      title: 'Risk & Insurance',
      subtitle: ctx ? `Heat-risk scoring across <b>${ranked.length} assets</b>. All indices are <b>THERMA analysis</b> — derived indicators for prioritization, not insurer ratings.` : 'Portfolio heat-risk indicators.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Generate Report', 'description', () => import('../app/zoe.js').then(() => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Generate a report' })))),
      ],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'shield', title: 'No risk context', message: 'Load heat data to compute asset risk bands.' }));
      return;
    }

    container.appendChild(kpiStripForAssets(assets));

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)]' });

    // ---------- left ----------
    const left = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    left.appendChild(card({
      title: 'Portfolio Risk Index', ic: 'shield',
      children: el('div', { class: 'flex items-center gap-md flex-wrap justify-around' },
        ringGauge({ value: avgIndex != null ? Math.round((avgIndex / 5) * 100) : null, label: 'avg risk', color: avgIndex >= 3.5 ? '#b91c1c' : '#f97316', sublabel: `${avgIndex != null ? avgIndex.toFixed(1) : '—'} / 5 mean index · THERMA analysis` }),
        (bandDonut(assets) || emptyState({ ic: 'data_usage', title: 'No bands yet' }))),
    }));

    left.appendChild(card({
      title: 'Spatial Distribution', ic: 'scatter_plot',
      subtitle: 'Assets per exposure band',
      children: (() => {
        const counts = {};
        ranked.forEach((a) => { counts[a.risk.band] = (counts[a.risk.band] || 0) + 1; });
        const order = ['Minimal', 'Low', 'Moderate', 'Warm', 'Elevated', 'Hot', 'High', 'Extreme', 'Critical'];
        const items = order.filter((b) => counts[b]).map((b) => ({ label: b, value: counts[b], color: bandColor(b) }));
        return items.length ? barChart({ items, fmt: (v) => String(v), height: 170 })
          : emptyState({ ic: 'hourglass_empty', title: 'Awaiting data' });
      })(),
    }));

    left.appendChild(el('div', { class: 'glass-panel rounded-2xl p-3 text-[11px] text-on-surface-variant/90 flex gap-sm' },
      icon('info', 'text-[16px] shrink-0 text-on-surface-variant'),
      el('span', {}, 'Exposure bands map surface-temperature persistence around each asset. They support operational prioritization and resilience planning; they are not actuarial loss estimates.')));

    // ---------- right ----------
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 min-h-0 lg:overflow-y-auto pr-1' });

    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[260px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5' },
      sourceBadge(ctx.source === 'live' ? 'fortyguard' : 'demo', ctx.demo)));
    right.appendChild(mapWrap);

    right.appendChild(card({
      title: `Asset Risk Register (${ranked.length})`, ic: 'fact_check',
      pad: false,
      className: 'hidden md:block',
      children: el('div', { class: 'table-scroll px-md pb-md' },
        el('table', { class: 'data-table' },
          el('thead', {}, el('tr', {}, ['Asset', 'Band', '°F est.', 'Index', '', ''].map((h) => el('th', {}, h)))),
          el('tbody', {}, ranked.map((a) => el('tr', {
            class: 'cursor-pointer',
            onclick: () => navigate('location', { param: `asset:${a.id}` }),
          },
          el('td', {}, el('span', { class: 'font-bold' }, a.name)),
          el('td', {}, bandChip(a.risk.band, bandColor(a.risk.band))),
          el('td', { class: 'font-black' }, `${Math.round(a.tempF)}°F`),
          el('td', { class: 'font-bold' }, `${a.risk.index}/5`),
          el('td', {}, riskBar(a.risk.index, bandColor(a.risk.band))),
          el('td', {}, icon('chevron_right', 'text-[15px] opacity-50', false))))))),
    }));

    right.appendChild(card({
      title: 'Top Risks', ic: 'priority_high',
      className: 'md:hidden',
      children: el('div', { class: 'grid gap-2', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' } },
        ranked.slice(0, 8).map((a) => el('button', {
          class: 'squishy-btn glass-chip rounded-xl p-2.5 text-left hover-lift',
          onclick: () => navigate('location', { param: `asset:${a.id}` }),
        },
        el('div', { class: 'flex items-center justify-between mb-1' },
          el('span', { class: 'text-[12px] font-bold truncate' }, a.name),
          bandChip(a.risk.band, bandColor(a.risk.band))),
        el('div', { class: 'text-[13px] font-black' }, `${Math.round(a.tempF)}°F`)))),
    }));

    grid.appendChild(left);
    grid.appendChild(right);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      for (const a of assets) {
        map.addMarker({
          lat: a.lat, lon: a.lon,
          label: `${a.name} · ${Math.round(a.tempF)}°F`,
          category: a.category,
          color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
          onClick: () => navigate('location', { param: `asset:${a.id}` }),
        });
      }
      if (ctx.location) map.focusPlace(ctx.location);

    screenEvent(window, 'therma:context', () => rerenderScreen('risk', container));
    });
  },
};
