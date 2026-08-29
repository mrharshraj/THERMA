// Leaflet map engine. One active instance at a time; screens mount it into
// their own container. preferCanvas keeps 7k+ tile polygons interactive.

import { isDarkTheme } from './theme.js';

const DEFAULT_CENTER = [25.7743, -80.1937]; // Downtown Miami
const DEFAULT_ZOOM = 12;

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const BAND_COLORS = {
  Cool: '#2b7de9', Mild: '#57b1ff', Warm: '#fed7aa',
  Hot: '#f97316', Extreme: '#b91c1c',
  Low: '#2b7de9', Moderate: '#57b1ff', Elevated: '#fed7aa', High: '#f97316', Critical: '#b91c1c',
  Minimal: '#57b1ff',
};

let instance = null; // { map, container, groups, handlers }
let shellListenersBound = false;
let containerObserver = null;

function baseLayer(dark) {
  return L.tileLayer(dark ? TILES.dark : TILES.light, {
    attribution: ATTRIB, maxZoom: 19, subdomains: 'abcd',
  });
}

function ensure(container, { center, zoom } = {}) {
  if (instance && instance.map) {
    if (instance.container === container) return instance;
    destroy();
  }
  const map = L.map(container, {
    preferCanvas: true,
    zoomControl: false,
    attributionControl: true,
    center: center || DEFAULT_CENTER,
    zoom: zoom || DEFAULT_ZOOM,
    zoomSnap: 0.5,
    wheelPxPerZoomLevel: 110,
  });
  const dark = isDarkTheme();
  const base = baseLayer(dark);
  base.addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const groups = {
    grid: L.layerGroup().addTo(map),
    aoi: L.layerGroup().addTo(map),
    markers: L.layerGroup().addTo(map),
    routes: L.layerGroup().addTo(map),
    highlight: L.layerGroup().addTo(map),
  };
  instance = { map, container, groups, base, dark, gridRenderer: null, tileClick: null, routeClick: null, markerClick: null };
  window.dispatchEvent(new CustomEvent('therma:map', { detail: { ready: true } }));
  return instance;
}

export function mount(container, opts = {}) {
  const inst = ensure(container, opts);
  setTimeout(() => inst.map.invalidateSize(), 60);
  // Shell-level listeners are bound exactly ONCE (mount() runs on every screen
  // mount; re-adding these leaked one resize listener per navigation).
  if (!shellListenersBound) {
    shellListenersBound = true;
    window.addEventListener('resize', onResize);
    // No theme listener: THERMA is dark-only, so the base tiles never swap.
  }
  // Track the container's own box: document flow, sidebar collapse and panel
  // changes resize map wrappers without a window resize event.
  if (containerObserver) containerObserver.disconnect();
  containerObserver = new ResizeObserver(() => {
    if (instance) instance.map.invalidateSize({ animate: false });
  });
  containerObserver.observe(container);
  return inst;
}

function onResize() {
  if (instance) instance.map.invalidateSize({ animate: false });
}

export function destroy() {
  if (!instance) return;
  if (containerObserver) { containerObserver.disconnect(); containerObserver = null; }
  try { instance.map.remove(); } catch { /* noop */ }
  instance = null;
}

export function get() {
  return instance;
}

export function swapBase() {
  if (!instance) return;
  const dark = isDarkTheme();
  if (dark === instance.dark) return;
  instance.map.removeLayer(instance.base);
  instance.base = baseLayer(dark).addTo(instance.map);
  instance.dark = dark;
}

// ---------------- heat grid ----------------

export function drawGrid(gridTiles, { onClick, opacity = 0.62, colorOf = null, tooltipOf = null } = {}) {
  if (!instance) return;
  clearGrid();
  instance.tileClick = onClick || null;
  // ALL vector layers (grid, AOI box, routes, highlight) must share the map's
  // single default canvas renderer. A separate per-draw renderer stacked a
  // second canvas above the grid — the AOI rectangle drawn there intercepted
  // every pointer event and cell clicks never reached the thermal polygons.
  const canvasRenderer = instance.map.getRenderer({ options: {} });
  for (const t of gridTiles) {
    if (!t.bounds) continue;
    const b = t.bounds;
    const color = colorOf ? colorOf(t) : ((t.layer && t.layer.color) || '#f97316');
    const poly = L.polygon(
      // Corners as Leaflet [lat, lon]. bounds b = [[lon0,lat0],[lon1,lat1]], so the
      // NW corner is [lat1, lon0] = [b[1][1], b[0][0]]. The old [b[1][1], b[0][1]]
      // repeated a latitude where the longitude belongs, folding every tile into a
      // self-intersecting bow-tie that only filled half the cell.
      [[b[0][1], b[0][0]], [b[0][1], b[1][0]], [b[1][1], b[1][0]], [b[1][1], b[0][0]]],
      {
        renderer: canvasRenderer,
        fillColor: color, fillOpacity: opacity,
        stroke: false, bubblingMouseEvents: false,
      }
    );
    poly.bindTooltip(tooltipOf ? tooltipOf(t) : formatTileTooltip(t), { sticky: true, direction: 'top', opacity: 0.95 });
    if (instance.tileClick) {
      poly.on('click', () => instance.tileClick(t));
    }
    poly.addTo(instance.groups.grid);
  }
}

function formatTileTooltip(t) {
  const isTemp = !t.layerName || t.units !== 'hour';
  const val = t.value != null ? Number(t.value).toFixed(1) : '—';
  const unit = t.units === 'hour' ? 'h' : '°C';
  let extra = '';
  if (isTemp && t.min != null && t.max != null) {
    extra = `<br><span style="opacity:.75">Range ${(Number(t.min) * 9 / 5 + 32).toFixed(0)}–${(Number(t.max) * 9 / 5 + 32).toFixed(0)}°F</span>`;
  }
  const band = t.layer ? ` · ${t.layer.band}` : '';
  return `<b>${val}${unit}${band}</b>${extra}`;
}

export function clearGrid() {
  if (instance) instance.groups.grid.clearLayers();
}

export function highlightTile(t) {
  if (!instance || !t || !t.bounds) return;
  instance.groups.highlight.clearLayers();
  const b = t.bounds;
  // 4th corner = NW = [lat1, lon0] = [b[1][1], b[0][0]] (see drawGrid).
  L.polygon([[b[0][1], b[0][0]], [b[0][1], b[1][0]], [b[1][1], b[1][0]], [b[1][1], b[0][0]]], {
    color: '#000', weight: 2.5, fill: false, dashArray: '4 3',
    interactive: false,   // decorative highlight — never blocks the grid
  }).addTo(instance.groups.highlight);
  instance.map.flyToBounds(boundsToLeaflet(t.bounds), { maxZoom: 16, duration: 0.6 });
}

export function clearHighlight() {
  if (instance) instance.groups.highlight.clearLayers();
}

function boundsToLeaflet(b) {
  return [[b[0][1], b[0][0]], [b[1][1], b[1][0]]];
}

// ---------------- AOI ----------------

export function drawAoiBounds(bbox) {
  if (!instance || !bbox) return;
  instance.groups.aoi.clearLayers();
  L.rectangle(boundsToLeaflet(bbox), {
    color: '#1a1b1f', weight: 1.5, dashArray: '6 5', fill: false,
    interactive: false,   // decorative frame — must never swallow grid clicks
  }).addTo(instance.groups.aoi);
}

// ---------------- markers ----------------

const CATEGORY_ICONS = {
  healthcare: 'local_hospital', energy: 'bolt', logistics: 'local_shipping',
  education: 'school', transit: 'tram', residential: 'apartment',
  retail: 'storefront', recreation: 'park', civic: 'account_balance',
  industrial: 'factory', water: 'water_drop', port: 'anchor',
};

export function addMarker({ lat, lon, label, category, selected = false, color = null, onClick }) {
  if (!instance || lat == null || lon == null) return null;
  const ic = CATEGORY_ICONS[category] || 'place';
  const bg = color || (isDarkTheme() ? '#e5e5e5' : '#171717');
  const fg = color ? '#fff' : (isDarkTheme() ? '#0b0b0b' : '#ffffff');
  const html = `<div class="map-pin ${selected ? 'selected' : ''}" style="background:${bg}"><span class="material-symbols-outlined" style="color:${fg};font-size:14px;">${ic}</span></div>`;
  const m = L.marker([lat, lon], {
    icon: L.divIcon({ html, className: 'map-pin-wrap', iconSize: [26, 26], iconAnchor: [13, 24] }),
    riseOnHover: true,
  });
  if (label) m.bindTooltip(label, { direction: 'top', offset: [0, -22] });
  if (onClick) m.on('click', () => onClick());
  m.addTo(instance.groups.markers);
  return m;
}

export function clearMarkers() {
  if (instance) instance.groups.markers.clearLayers();
}

export function selectMarker(lat, lon, label) {
  clearMarkers();
  addMarker({ lat, lon, label, selected: true });
}

// ---------------- routes ----------------

export function drawRoutes(routes, selectedId, { onSelect, endpoints = null } = {}) {
  if (!instance) return;
  clearRoutes();
  instance.routeClick = onSelect || null;
  // Origin/destination markers — the corridor endpoints must stay visible
  // alongside the geometry. Coordinates come from the same routing response
  // that produced the lines (never from map centre or hardcoded points).
  if (endpoints && endpoints.from) {
    addMarker({ lat: endpoints.from.lat, lon: endpoints.from.lon, label: `Origin · ${endpoints.from.name || ''}`, category: 'transit', color: '#f5f5f5' });
  }
  if (endpoints && endpoints.to) {
    addMarker({ lat: endpoints.to.lat, lon: endpoints.to.lon, label: `Destination · ${endpoints.to.name || ''}`, category: 'recreation', color: '#b91c1c' });
  }
  routes.forEach((r) => {
    if (!r.geometry || !r.geometry.coordinates) return;
    const latlngs = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const selected = r.id === selectedId;
    const bandColor = r.exposure && r.exposure.band ? (BAND_COLORS[r.exposure.band] || '#f97316') : '#f97316';
    if (selected) {
      // halo under the selected route
      L.polyline(latlngs, { color: '#ffffff', weight: 10, opacity: 0.35, lineCap: 'round' }).addTo(instance.groups.routes);
    }
    const line = L.polyline(latlngs, {
      color: selected ? bandColor : (isDarkTheme() ? '#8f9096' : '#55585c'),
      weight: selected ? 6 : 3.5,
      opacity: selected ? 0.95 : 0.65,
      dashArray: selected ? null : '7 8',
      lineCap: 'round',
    });
    line.bindTooltip(`${r.label || r.id} — ${r.exposure ? r.exposure.meanF + '°F avg' : 'exposure n/a'}`, { sticky: true });
    if (onSelect) line.on('click', () => onSelect(r.id));
    line.addTo(instance.groups.routes);
  });
  const sel = routes.find((r) => r.id === selectedId) || routes[0];
  if (sel && sel.geometry) fitLine(sel.geometry.coordinates);
}

export function clearRoutes() {
  if (instance) instance.groups.routes.clearLayers();
}

export function drawRouteSegments(route) {
  if (!instance || !route.segments) return;
  for (const s of route.segments) {
    if (!s.center || s.avgC == null) continue;
    const color = (s.exposure && s.exposure.color) || '#f97316';
    L.circleMarker([s.center.lat, s.center.lon], {
      radius: 6, fillColor: color, fillOpacity: 0.9, color: '#ffffff', weight: 1.5,
    }).bindTooltip(`Segment ${s.index + 1}: ${Number(s.avgF).toFixed(0)}°F avg`, { direction: 'top' })
      .addTo(instance.groups.routes);
  }
}

function fitLine(coords) {
  if (!instance || !coords || !coords.length) return;
  const latlngs = coords.map(([lon, lat]) => [lat, lon]);
  instance.map.fitBounds(L.latLngBounds(latlngs).pad(0.15), { animate: true });
}

// ---------------- view control ----------------

export function focusPlace(place, zoom = 13) {
  if (!instance || !place) return;
  instance.map.flyTo([place.lat, place.lon], zoom, { duration: 0.8 });
  if (place.bbox) drawAoiBounds(place.bbox);
}

export function fitAoi(bbox) {
  if (!instance || !bbox) return;
  instance.map.fitBounds(boundsToLeaflet(bbox).map((x) => x), { padding: [24, 24] });
}

export function resetView() {
  if (!instance) return;
  instance.map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.7 });
  clearHighlight();
}

export function zoomBy(delta) {
  if (!instance) return;
  instance.map.setZoom(instance.map.getZoom() + delta);
}

export function toggleFullscreen(containerEl) {
  const target = containerEl || (instance && instance.container);
  if (!target) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else target.requestFullscreen && target.requestFullscreen();
  setTimeout(() => instance && instance.map.invalidateSize(), 250);
}

export function locateMe() {
  if (!instance) return;
  instance.map.locate({ setView: true, maxZoom: 14 });
}
