// Facility Analysis (facility_analysis) — operational facilities lens with
// responsive table (desktop) / cards (mobile).

import { getState } from '../app/store.js';
import { el, icon, pageHeader, card, emptyState, btnGhost, sourceBadge, bandChip, tempF } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { sortedByRisk, bandColor, kpiStripForAssets, riskBar } from './_shared-assets.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

const FACILITY_CATS = ['industrial', 'energy', 'water', 'port', 'healthcare', 'logistics'];

let selectedId = null;

export default {
  title: 'Facility Analysis',
  async render(container) {
    selectedId = null;
    const st = getState();
    const ctx = st.context;
    const all = ctx ? ctx.assets || [] : [];
    const facilities = all.filter((a) => FACILITY_CATS.includes(a.category));
    const list = facilities.length ? facilities : all;

    container.appendChild(pageHeader({
      eyebrow: 'OPERATIONS',
      title: 'Facility Analysis',
      subtitle: ctx ? `Thermal stress profile for <b>${list.length} operational facilities</b> — plants, utilities, ports and critical care sites.` : 'Facility-level thermal analysis.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Infrastructure View', 'bolt', () => navigate('utilities')),
        btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Which facility needs inspection first?' }))),
      ],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'factory', title: 'No facility context', message: 'Load a location to profile its facilities.' }));
      return;
    }

    container.appendChild(kpiStripForAssets(list));

    const ranked = sortedByRisk(list);

    // ---------- table (desktop) ----------
    container.appendChild(card({
      title: 'Facility Exposure Matrix', ic: 'table_chart', pad: false,
      subtitle: 'THERMA exposure scoring over FortyGuard heat layers',
      className: 'hidden md:block',
      children: el('div', { class: 'table-scroll px-md pb-md' },
        el('table', { class: 'data-table' },
          el('thead', {}, el('tr', {},
            ['Facility', 'Category', 'Surface °F', 'Band', 'Risk Index', 'Status', ''].map((h) => el('th', {}, h)))),
          el('tbody', {}, ranked.map((a) => el('tr', {
            style: a.id === selectedId ? { background: 'rgba(249,115,22,.08)' } : {},
            onclick: () => selectAsset(a.id),
            class: 'cursor-pointer',
          },
          el('td', {}, el('span', { class: 'font-bold' }, a.name)),
          el('td', { class: 'capitalize' }, a.category),
          el('td', { class: 'font-black' }, a.tempF != null ? `${Math.round(a.tempF)}°F` : '—'),
          el('td', {}, a.risk ? bandChip(a.risk.band, bandColor(a.risk.band)) : '—'),
          el('td', {}, riskBar(a.risk ? a.risk.index : 0, a.risk ? bandColor(a.risk.band) : '#888')),
          el('td', {}, a.risk && a.risk.index >= 4
            ? el('span', { class: 'text-[11px] font-bold text-red-600 dark:text-red-400' }, 'Inspect at next cool window')
            : el('span', { class: 'text-[11px] font-semibold text-on-surface-variant/80' }, 'Monitor')),
          el('td', {}, icon('chevron_right', 'text-[16px] opacity-50', false))))))),
    }));

    // ---------- cards (mobile) ----------
    const mobileCards = card({
      title: `Facilities (${ranked.length})`, ic: 'factory',
      className: 'md:hidden',
      children: el('div', { class: 'grid gap-2', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' } },
        ranked.map((a) => facilityCard(a))),
    });
    container.appendChild(mobileCards);

    // ---------- map + selected detail ----------
    const grid = el('div', { class: 'grid gap-md mt-md grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]' });
    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[320px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5' },
      sourceBadge(ctx.source === 'live' ? 'fortyguard' : 'demo', ctx.demo)));
    grid.appendChild(mapWrap);

    grid.appendChild(detailPanel(ranked));
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      for (const a of list) {
        map.addMarker({
          lat: a.lat, lon: a.lon,
          label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
          category: a.category,
          color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
          onClick: () => selectAsset(a.id),
        });
      }
      if (ctx.location) map.focusPlace(ctx.location);
    });

    screenEvent(window, 'therma:context', () => rerenderScreen('facilities', container));
  },
};

function selectAsset(id) {
  selectedId = id;
  navigate('location', { param: `asset:${id}`, query: { view: 'facility' } });
}

function facilityCard(a) {
  return el('button', {
    class: 'squishy-btn glass-panel rounded-2xl p-3 text-left hover-lift w-full',
    onclick: () => selectAsset(a.id),
  },
  el('div', { class: 'flex items-start justify-between gap-2' },
    el('span', { class: 'font-bold text-[13px]' }, a.name),
    a.risk ? bandChip(a.risk.band, bandColor(a.risk.band)) : null),
  el('div', { class: 'flex items-center justify-between mt-2' },
    el('span', { class: 'capitalize text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/65' }, a.category),
    el('span', { class: 'text-[16px] font-black' }, tempF(a.tempF))),
  riskBar(a.risk ? a.risk.index : 0, a.risk ? bandColor(a.risk.band) : '#888'));
}

function detailPanel(ranked) {
  const sel = ranked.find((a) => a.id === selectedId);
  return card({
    title: sel ? `${sel.name} — Profile` : 'Facility Detail', ic: 'precision_manufacturing',
    children: sel
      ? el('div', { class: 'flex flex-col gap-sm' },
        el('div', { class: 'flex items-center justify-between' },
          el('span', { class: 'kpi-value', html: tempF(sel.tempF) }),
          sel.risk ? bandChip(sel.risk.band, bandColor(sel.risk.band)) : null),
        kvRows([
          ['Category', sel.category],
          ['Coordinates', `${sel.lat.toFixed(4)}, ${sel.lon.toFixed(4)}`],
          ['Risk index', sel.risk ? `${sel.risk.index}/5` : '—'],
          ['Estimate basis', 'Nearest FortyGuard cell · THERMA analysis'],
        ]),
        el('button', {
          class: 'squishy-btn bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface rounded-full px-4 py-2 text-[12px] font-bold self-start',
          onclick: () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: `What should we do about ${sel.name}?` })),
        }, 'Ask Zoe for mitigation steps'))
      : emptyState({ ic: 'touch_app', title: 'Select a facility', message: 'Choose any row or marker to open its thermal profile and recommended actions.' }),
  });
}

function kvRows(pairs) {
  return el('div', { class: 'grid grid-cols-2 gap-xs' }, pairs.map(([k, v]) => el('div', {},
    el('span', { class: 'block text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, k),
    el('span', { class: 'text-[12.5px] font-semibold capitalize' }, v))));
}
