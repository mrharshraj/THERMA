// Map Explorer — free exploration of layers + assets (map_explorer).

import { getState } from '../app/store.js';
import { loadGridLayer } from '../app/api.js';
import { el, icon, pageHeader, card, statTile, bandChip, sourceBadge, tempF, num, emptyState, btnGhost, toast, loadingState } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';
import { layerDomain, colorFor, legendFor, describeTile } from '../app/layers.js';

const CATEGORIES = [
  ['healthcare', 'local_hospital'], ['energy', 'bolt'], ['logistics', 'local_shipping'],
  ['education', 'school'], ['transit', 'tram'], ['residential', 'apartment'],
  ['retail', 'storefront'], ['recreation', 'park'], ['civic', 'account_balance'],
  ['industrial', 'factory'], ['water', 'water_drop'], ['port', 'anchor'],
];

let activeCats = new Set(CATEGORIES.map(([c]) => c));

export default {
  title: 'Map Explorer',
  layout: 'fixed',   // lg+: fixed map shell + scrolling side panel; below lg the page scrolls
  async render(container) {
    const st = getState();
    const ctx = st.context;

    // Register the data-refresh hook FIRST — the loading/error branches below
    // return early, and a screen mounted mid-load must still re-render when
    // the context arrives (else it stays stuck on "Preparing…").
    screenEvent(window, 'therma:context', () => rerenderScreen('explorer', container));

    container.appendChild(pageHeader({
      eyebrow: 'GEOSPATIAL EXPLORER',
      title: 'Map Explorer',
      subtitle: ctx ? `Freely explore <b>${ctx.location.display}</b> — switch thermal layers, filter assets, click anything.` : 'Explore the thermal map.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [placePicker(), btnGhost('Heat Intelligence', 'local_fire_department', () => navigate('heat'))],
    }));

    if (!ctx && st.contextLoading) {
      container.appendChild(loadingState('Preparing the explorer…'));
      return;
    }
    if (!ctx && st.contextError) {
      container.appendChild(el('div', { class: 'glass-panel rounded-2xl p-lg text-center' },
        el('p', { class: 'font-bold' }, 'Heat context unavailable — exploration is limited until a location loads.'),
        el('div', { class: 'mt-sm flex justify-center gap-xs' },
          btnGhost('Open Global Search', 'search', () => navigate('search')))));
      return;
    }

    const body = el('div', { class: 'flex gap-md flex-1 min-h-0' });

    // side panel (desktop)
    const panel = el('div', { class: 'hidden lg:flex w-[300px] shrink-0 flex-col gap-md overflow-y-auto' });
    panel.appendChild(layerPanel());
    panel.appendChild(assetFilterPanel());
    panel.appendChild(legendCard());
    body.appendChild(panel);

    // mobile layer switcher (the full panel is desktop-only; layers are the
    // primary control, so they stay reachable on small screens)
    const mobileLayers = el('div', { class: 'lg:hidden flex gap-1.5 overflow-x-auto pb-1 mb-1' },
      [['temperature', 'Temperature', 'thermostat'], ['persistence', 'Persistence', 'schedule'], ['exceedance', 'Exceedance', 'moving'], ['time_of_measure', 'Peak Time', 'wb_twilight']].map(([id, label, ic]) => {
        const active = getState().gridLayer === id;
        return el('button', {
          class: `squishy-btn glass-chip rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 ${active ? 'ring-1 ring-primary' : ''}`,
          onclick: async () => {
            import('../app/store.js').then(({ setState }) => setState({ gridLayer: id }));
            try {
              const payload = await loadGridLayer(getState().place.id, id);
              drawTiles(payload);
            } catch (err) {
              toast(err.message || 'Layer unavailable.', 'error');
            }
          },
        }, icon(ic, 'text-[14px]', false), label);
      }));
    container.appendChild(mobileLayers);
    container.appendChild(body);

    // map
    const mapWrap = el('div', { class: 'relative flex-1 rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 bg-surface-container-low min-h-[440px]' });
    mapWrap.appendChild(el('div', { class: 'absolute top-3 right-3 z-[500] flex flex-col gap-1.5' },
      expCtrl('my_location', 'Locate me', () => map.locateMe()),
      expCtrl('refresh', 'Reset view', () => map.resetView()),
      expCtrl('fullscreen', 'Fullscreen', () => map.toggleFullscreen(mapWrap))));
    body.appendChild(mapWrap);

    requestAnimationFrame(async () => {
      map.mount(mapWrap);
      await paintExplorer();
    });
  },
};

function expCtrl(icName, title, onClick) {
  return el('button', { class: 'map-ctrl', title, 'aria-label': title, onclick: onClick }, icon(icName, 'text-[18px]', false));
}

async function paintExplorer() {
  const st = getState();
  const ctx = st.context;
  if (!ctx) return;
  try {
    const payload = await loadGridLayer(st.place.id, st.gridLayer);
    drawTiles(payload);
  } catch (err) {
    toast(err.message || 'Layer unavailable.', 'warn');
    drawTiles({ grid: (ctx.heatmap && ctx.heatmap.grid) || [], units: ctx.heatmap && ctx.heatmap.units });
  }
  drawAssets();
  if (ctx.location) map.focusPlace(ctx.location);
}

function drawTiles(payload) {
  const layer = payload.layer || getState().gridLayer || 'temperature';
  const tiles = (payload.grid || []).filter((t) => t.value != null);
  const domain = layerDomain(layer, tiles);
  map.drawGrid(tiles.map((t) => ({ ...t, units: payload.units, layerName: payload.layer })), {
    opacity: layer === 'time_of_measure' ? 0.72 : 0.58,
    colorOf: (t) => colorFor(layer, t, domain),
    tooltipOf: (t) => {
      const d = describeTile(layer, t);
      return `<b>${d.main}</b>`;
    },
    onClick: (t) => showTilePopup(t, payload),
  });
  // keep the legend in sync with the rendered layer
  const def = legendFor(layer, domain);
  document.querySelectorAll('[data-legend-title]').forEach((p) => { p.textContent = def.title.toUpperCase(); });
  document.querySelectorAll('[data-legend-bar]').forEach((b) => { b.style.background = `linear-gradient(90deg, ${def.stops.join(', ')})`; });
  document.querySelectorAll('[data-legend-labels]').forEach((h) => {
    h.innerHTML = '';
    def.labels.forEach((t) => h.appendChild(el('span', {}, t)));
  });
}

function showTilePopup(t, payload) {
  const layer = payload.layer || getState().gridLayer || 'temperature';
  const d = describeTile(layer, t);
  L.popup({ closeButton: true })
    .setLatLng([t.center.lat, t.center.lon])
    .setContent(`
      <div style="min-width:190px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <b style="font-size:15px;">${d.main}</b>
          ${t.layer ? `<span style="background:${t.layer.color}22;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:800;">${t.layer.band}</span>` : ''}
        </div>
        ${d.rows.map(([k, v]) => `<div style="font-size:11px;margin-top:3px;opacity:.8;">${k}: ${v}</div>`).join('')}
      </div>`)
    .openOn(map.get().map);
}

function layerPanel() {
  const layers = [
    ['temperature', 'Temperature', 'thermostat'],
    ['persistence', 'Persistence', 'schedule'],
    ['exceedance', 'Exceedance', 'moving'],
    ['time_of_measure', 'Peak Time', 'wb_twilight'],
  ];
  return card({
    title: 'Thermal Layer', ic: 'layers',
    children: el('div', { class: 'flex flex-col gap-1' },
      layers.map(([id, label, ic]) => {
        const active = getState().gridLayer === id;
        return el('button', {
          class: `squishy-btn rounded-xl px-3 py-2 flex items-center gap-2 text-[12px] font-bold ${active ? 'bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface' : 'hover:bg-surface-container/70'}`,
          onclick: async () => {
            import('../app/store.js').then(({ setState }) => setState({ gridLayer: id }));
            try {
              const payload = await loadGridLayer(getState().place.id, id);
              drawTiles(payload);
            } catch (err) {
              toast(err.message || 'Layer unavailable.', 'error');
            }
          },
        }, icon(ic, 'text-[16px]', false), label);
      })),
  });
}

function assetFilterPanel() {
  return card({
    title: 'Asset Categories', ic: 'category',
    children: el('div', {},
      el('div', { class: 'grid grid-cols-2 gap-1' },
        CATEGORIES.map(([cat, ic]) => {
          const on = activeCats.has(cat);
          return el('button', {
            class: `squishy-btn rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-[10.5px] font-bold capitalize ${on ? 'bg-surface-container-high dark:bg-surface-container' : 'opacity-45 hover:opacity-80'}`,
            dataset: { cat: cat },
            onclick: (e) => {
              if (activeCats.has(cat)) activeCats.delete(cat); else activeCats.add(cat);
              e.currentTarget.className = `squishy-btn rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-[10.5px] font-bold capitalize ${activeCats.has(cat) ? 'bg-surface-container-high dark:bg-surface-container' : 'opacity-45 hover:opacity-80'}`;
              drawAssets();
            },
          }, icon(ic, 'text-[14px]', false), cat);
        })),
      el('p', { class: 'text-[10px] text-on-surface-variant/70 mt-2' }, 'Markers colored red/orange when assets sit in high or critical heat bands.')),
  });
}

function legendCard() {
  return card({
    title: 'Legend', ic: 'palette',
    children: el('div', {},
      el('p', { class: 'text-[9.5px] font-black uppercase tracking-wider text-on-surface-variant/70 mb-1.5', dataset: { legendTitle: '' } }, legendFor(getState().gridLayer).title.toUpperCase()),
      el('div', { class: 'w-full h-2.5 rounded-full mb-1.5', dataset: { legendBar: '' }, style: { background: `linear-gradient(90deg, ${legendFor(getState().gridLayer).stops.join(', ')})` } }),
      el('div', { class: 'flex justify-between text-[9px] font-bold text-on-surface-variant/85', dataset: { legendLabels: '' } },
        legendFor(getState().gridLayer).labels.map((t) => el('span', {}, t))),
      el('p', { class: 'text-[10px] text-on-surface-variant/75 mt-2' }, 'Color scale changes with the selected analysis layer.'),
      el('div', { class: 'mt-md flex items-center justify-between', dataset: { tileCount: '' } })),
  });
}

function drawAssets() {
  const ctx = getState().context;
  if (!ctx) return;
  map.clearMarkers();
  for (const a of ctx.assets || []) {
    if (!activeCats.has(a.category)) continue;
    map.addMarker({
      lat: a.lat, lon: a.lon,
      label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
      category: a.category,
      color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
      onClick: () => navigate('location', { param: `asset:${a.id}` }),
    });
  }
}
