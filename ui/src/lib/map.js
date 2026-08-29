// Leaflet map wrapper (ported from public/app/map.js)

import L from "leaflet";
import { getState } from "./store.js";

const DEFAULT_CENTER = [25.7743, -80.1937];
const DEFAULT_ZOOM = 12;

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
};
const ATTRIB = "\u00a9 <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> \u00a9 <a href=\"https://carto.com/attributions\">CARTO</a>";

export const BAND_COLORS = {
  Cool: "#2b7de9", Mild: "#57b1ff", Warm: "#fed7aa",
  Hot: "#f97316", Extreme: "#b91c1c",
  Low: "#2b7de9", Moderate: "#57b1ff", Elevated: "#fed7aa", High: "#f97316", Critical: "#b91c1c",
  Minimal: "#57b1ff"
};

let instance = null;

function baseLayer(dark) {
  return L.tileLayer(dark ? TILES.dark : TILES.light, {
    attribution: ATTRIB, maxZoom: 19, subdomains: "abcd"
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
    wheelPxPerZoomLevel: 110
  });
  const dark = document.documentElement.classList.contains("dark");
  const base = baseLayer(dark);
  base.addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const groups = {
    grid: L.layerGroup().addTo(map),
    aoi: L.layerGroup().addTo(map),
    markers: L.layerGroup().addTo(map),
    routes: L.layerGroup().addTo(map),
    highlight: L.layerGroup().addTo(map)
  };
  instance = { map, container, groups, base, dark, tileClick: null, routeClick: null, markerClick: null };
  window.dispatchEvent(new CustomEvent("therma:map", { detail: { ready: true } }));
  return instance;
}

export function mount(container, opts = {}) {
  const inst = ensure(container, opts);
  setTimeout(() => inst.map.invalidateSize(), 60);
  window.addEventListener("resize", onResize);
  window.addEventListener("therma:theme", () => swapBase());
  return inst;
}

function onResize() {
  if (instance) instance.map.invalidateSize({ animate: false });
}

export function destroy() {
  if (!instance) return;
  try { instance.map.remove(); } catch {}
  instance = null;
}

export function get() {
  return instance;
}

export function swapBase() {
  if (!instance) return;
  const dark = document.documentElement.classList.contains("dark");
  if (dark === instance.dark) return;
  instance.map.removeLayer(instance.base);
  instance.base = baseLayer(dark).addTo(instance.map);
  instance.dark = dark;
}

// ---------------- heat grid ----------------

export function drawGrid(gridTiles, { onClick, opacity = 0.62 } = {}) {
  if (!instance) return;
  clearGrid();
  instance.tileClick = onClick || null;
  const canvasRenderer = L.canvas({ padding: 0.4 });
  for (const t of gridTiles) {
    if (!t.bounds) continue;
    const b = t.bounds;
    const color = (t.layer && t.layer.color) || "#f97316";
    const poly = L.polygon(
      [[b[0][1], b[0][0]], [b[0][1], b[1][0]], [b[1][1], b[1][0]], [b[1][1], b[0][0]]],
      {
        renderer: canvasRenderer,
        fillColor: color, fillOpacity: opacity,
        stroke: false, bubblingMouseEvents: false
      }
    );
    poly.bindTooltip(formatTileTooltip(t), { sticky: true, direction: "top", opacity: 0.95 });
    if (instance.tileClick) {
      poly.on("click", () => instance.tileClick(t));
    }
    poly.addTo(instance.groups.grid);
  }
}

function formatTileTooltip(t) {
  const isTemp = !t.layerName || t.units !== "hour";
  const val = t.value != null ? Number(t.value).toFixed(1) : "\u2014";
  const unit = t.units === "hour" ? "h" : "\u00b0C";
  let extra = "";
  if (isTemp && t.min != null && t.max != null) {
    extra = `<br><span style="opacity:.75">Range ${(Number(t.min) * 9 / 5 + 32).toFixed(0)}\u2013${(Number(t.max) * 9 / 5 + 32).toFixed(0)}\u00b0F</span>`;
  }
  const band = t.layer ? ` \u00b7 ${t.layer.band}` : "";
  return `<b>${val}${unit}${band}</b>${extra}`;
}

export function clearGrid() {
  if (instance) instance.groups.grid.clearLayers();
}

export function highlightTile(t) {
  if (!instance || !t || !t.bounds) return;
  instance.groups.highlight.clearLayers();
  const b = t.bounds;
  L.polygon([[b[0][1], b[0][0]], [b[0][1], b[1][0]], [b[1][1], b[1][0]], [b[1][1], b[0][0]]], {
    color: "#000", weight: 2.5, fill: false, dashArray: "4 3"
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
    color: "#1a1b1f", weight: 1.5, dashArray: "6 5", fill: false
  }).addTo(instance.groups.aoi);
}

// ---------------- markers ----------------

const CATEGORY_ICONS = {
  healthcare: "local_hospital", energy: "bolt", logistics: "local_shipping",
  education: "school", transit: "tram", residential: "apartment",
  retail: "storefront", recreation: "park", civic: "account_balance",
  industrial: "factory", water: "water_drop", port: "anchor",
  communications: "cell_tower"
};

export function addMarker({ lat, lon, label, category, selected = false, color = null, onClick }) {
  if (!instance || lat == null || lon == null) return null;
  const ic = CATEGORY_ICONS[category] || "place";
  const bg = color || (document.documentElement.classList.contains("dark") ? "#e5e2e1" : "#1c1b1b");
  const fg = color ? "#fff" : (document.documentElement.classList.contains("dark") ? "#1a1c1c" : "#ffffff");
  const html = `<div class="map-pin ${selected ? "selected" : ""}" style="background:${bg}"><span class="material-symbols-outlined" style="color:${fg};font-size:14px;">${ic}</span></div>`;
  const m = L.marker([lat, lon], {
    icon: L.divIcon({ html, className: "map-pin-wrap", iconSize: [26, 26], iconAnchor: [13, 24] }),
    riseOnHover: true
  });
  if (label) m.bindTooltip(label, { direction: "top", offset: [0, -22] });
  if (onClick) m.on("click", () => onClick());
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

export function drawRoutes(routes, selectedId, { onSelect } = {}) {
  if (!instance) return;
  clearRoutes();
  instance.routeClick = onSelect || null;
  routes.forEach(r => {
    if (!r.geometry || !r.geometry.coordinates) return;
    const latlngs = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const selected = r.id === selectedId;
    const bandColor = r.exposure && r.exposure.band ? (BAND_COLORS[r.exposure.band] || "#f97316") : "#f97316";
    if (selected) {
      L.polyline(latlngs, { color: "#ffffff", weight: 10, opacity: 0.35, lineCap: "round" }).addTo(instance.groups.routes);
    }
    const line = L.polyline(latlngs, {
      color: selected ? bandColor : (document.documentElement.classList.contains("dark") ? "#8f9096" : "#55585c"),
      weight: selected ? 6 : 3.5,
      opacity: selected ? 0.95 : 0.65,
      dashArray: selected ? null : "7 8",
      lineCap: "round"
    });
    line.bindTooltip(`${r.label || r.id} \u2014 ${r.exposure ? r.exposure.meanF + "\u00b0F avg" : "exposure n/a"}`, { sticky: true });
    if (onSelect) line.on("click", () => onSelect(r.id));
    line.addTo(instance.groups.routes);
  });
  const sel = routes.find(r => r.id === selectedId) || routes[0];
  if (sel && sel.geometry) fitLine(sel.geometry.coordinates);
}

export function clearRoutes() {
  if (instance) instance.groups.routes.clearLayers();
}

export function drawRouteSegments(route) {
  if (!instance || !route.segments) return;
  for (const s of route.segments) {
    if (!s.center || s.avgC == null) continue;
    const color = (s.exposure && s.exposure.color) || "#f97316";
    L.circleMarker([s.center.lat, s.center.lon], {
      radius: 6, fillColor: color, fillOpacity: 0.9, color: "#ffffff", weight: 1.5
    }).bindTooltip(`Segment ${s.index + 1}: ${Number(s.avgF).toFixed(0)}\u00b0F avg`, { direction: "top" })
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
  instance.map.fitBounds(boundsToLeaflet(bbox).map(x => x), { padding: [24, 24] });
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

// CSS for map pins (injected once)
if (!document.getElementById("therma-map-pin-styles")) {
  const style = document.createElement("style");
  style.id = "therma-map-pin-styles";
  style.textContent = `
    .map-pin { width: 26px; height: 26px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid #fff; cursor: pointer; transition: transform 0.1s; }
    .map-pin:hover { transform: rotate(-45deg) scale(1.1); }
    .map-pin .material-symbols-outlined { transform: rotate(45deg); }
    .map-pin.selected { box-shadow: 0 0 0 3px #c8c6c5, 0 2px 8px rgba(0,0,0,0.3); }
    .map-pin-wrap { pointer-events: none; }
  `;
  document.head.appendChild(style);
}
