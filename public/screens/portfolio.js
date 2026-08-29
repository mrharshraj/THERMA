// Portfolio Monitoring — multi-asset heat exposure (portfolio_monitoring).

import { getState } from '../app/store.js';
import { el, icon, pageHeader, card, emptyState, btnGhost, sourceBadge } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { assetCard, bandDonut, topExposureBars, kpiStripForAssets, sortedByRisk } from './_shared-assets.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

let selectedId = null;

export default {
  title: 'Portfolio Monitoring',
  async render(container) {
    selectedId = null;
    const st = getState();
    const ctx = st.context;
    const assets = ctx ? ctx.assets || [] : [];

    container.appendChild(pageHeader({
      eyebrow: 'ASSET PORTFOLIO',
      title: 'Portfolio Monitoring',
      subtitle: ctx ? `Heat exposure across <b>${assets.length} monitored assets</b> in ${ctx.location.display}. Select an asset to inspect it on the map and open its profile.` : 'Multi-asset heat exposure monitoring.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [placePicker(), btnGhost('Urban & Property', 'apartment', () => navigate('urban'))],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'domain', title: 'No portfolio context', message: 'Load a location to populate the monitored asset network.' }));
      return;
    }

    container.appendChild(kpiStripForAssets(assets));

    const grid = el('div', { class: 'grid gap-md grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]' });

    // left: map + aggregate charts
    const left = el('div', { class: 'flex flex-col gap-md min-w-0' });
    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[340px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'absolute top-3 right-3 z-[500] flex flex-col gap-1.5' },
      el('button', { class: 'map-ctrl', title: 'Fullscreen', onclick: () => map.toggleFullscreen(mapWrap) }, icon('fullscreen', 'text-[18px]', false))));
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5' },
      sourceBadge(ctx.source === 'live' ? 'fortyguard' : 'demo', ctx.demo)));
    left.appendChild(mapWrap);

    left.appendChild(card({
      title: 'Top Thermal Exposure', ic: 'local_fire_department',
      subtitle: 'Hottest assets by estimated surface °F',
      children: topExposureBars(assets) || emptyState({ ic: 'thermostat', title: 'No exposure data', message: 'Assets populate once heat data is loaded.' }),
    }));

    // right: donut + list
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });
    right.appendChild(card({
      title: 'Risk Band Distribution', ic: 'donut_small',
      children: bandDonut(assets) || emptyState({ ic: 'data_usage', title: 'Awaiting heat data' }),
    }));
    right.appendChild(assetList(assets));

    grid.appendChild(left);
    grid.appendChild(right);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      drawPortfolioMap(assets);
      if (ctx.location) map.focusPlace(ctx.location);
      focusSelected();
    });

    screenEvent(window, 'therma:context', () => rerenderScreen('portfolio', container));
  },
};

function focusSelected() {
  if (!selectedId) return;
  const a = (getState().context.assets || []).find((x) => x.id === selectedId);
  if (a) map.get().map.panTo([a.lat, a.lon]);
}

function drawPortfolioMap(assets) {
  for (const a of assets) {
    map.addMarker({
      lat: a.lat, lon: a.lon,
      label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
      category: a.category,
      color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
      onClick: () => {
        selectedId = a.id;
        rerenderList();
        import('../app/zoe.js');
      },
    });
  }
}

function rerenderList() {
  const host = document.querySelector('[data-portfolio-list]');
  if (!host) return;
  const assets = getState().context.assets || [];
  host.replaceChildren(...assetRows(assets));
}

function assetRows(assets) {
  const ranked = sortedByRisk(assets);
  if (!ranked.length) return [emptyState({ ic: 'inbox', title: 'No assets with data yet' })];
  return ranked.map((a) => assetCard(a, {
    selected: a.id === selectedId,
    onClick: () => {
      selectedId = a.id;
      rerenderList();
      if (map.get()) {
        map.get().map.flyTo([a.lat, a.lon], 15, { duration: 0.7 });
      }
    },
  }));
}

function assetList(assets) {
  return card({
    title: `Monitored Assets (${assets.length})`, ic: 'list_alt',
    children: el('div', { class: 'flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1', dataset: { portfolioList: '' } },
      assetRows(assets)),
  });
}
