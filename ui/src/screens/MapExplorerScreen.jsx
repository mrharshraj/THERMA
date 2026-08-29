// Map Explorer Screen (from ui/map_explorer/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer, geoSearch } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, clearGrid, focusPlace } from "../lib/map.js";
import { el, icon, toast, tempF } from "../lib/widgets.js";

let mapMounted = false;
let unsubscribe = null;
let selectedAsset = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "relative w-full h-full flex flex-col" },
    // Map Background - will be replaced by Leaflet
    el("div", { id: "map-explorer", class: "absolute inset-0 z-0" }),
    el("div", { class: "absolute inset-0 bg-background/20 pointer-events-none z-0" }),
    // UI Overlay Layer
    el("div", { class: "relative z-10 w-full h-full pointer-events-none flex p-[16px] gap-[16px]" },
      // Left Side: Controls & Layers
      el("div", { class: "flex flex-col gap-[16px] pointer-events-auto w-80 shrink-0 h-full justify-between" },
        // Top: Search & Filters
        el("div", { class: "flex flex-col gap-[4px]" },
          el("div", { class: "bg-surface/80 backdrop-blur-xl shadow-xl rounded-xl overflow-hidden flex flex-col pointer-events-auto" },
            el("div", { class: "p-[16px] border-b border-outline-variant/10" },
              el("div", { class: "flex items-center bg-surface-container-low px-4 py-3 rounded-lg border border-outline-variant/20 focus-within:border-tertiary transition-colors" },
                icon("search", "text-on-surface-variant mr-3 text-[20px]"),
                el("input", { class: "bg-transparent border-none outline-none text-body-md font-body-md text-on-surface w-full placeholder:text-on-surface-variant", placeholder: "Search coordinates, cities, assets...", type: "text", id: "map-search-input" })
              )
            ),
            el("div", { class: "p-[16px] flex flex-col gap-4 bg-surface/50" },
              el("div", { class: "flex justify-between items-center cursor-pointer", onclick: () => document.getElementById("filters-panel").classList.toggle("hidden") },
                el("span", { class: "text-data-mono font-data-mono text-[10px] uppercase tracking-widest text-outline" }, "Active Filters (3)"),
                icon("tune", "text-outline text-[16px]")
              ),
              el("div", { class: "hidden flex-col gap-3", id: "filters-panel" },
                el("div", {},
                  el("label", { class: "text-data-mono font-data-mono text-[10px] uppercase text-on-surface-variant mb-2 block" }, "Risk Level"),
                  el("div", { class: "flex gap-2" },
                    el("button", { class: "flex-1 py-1 px-2 rounded bg-error/20 text-error text-data-mono font-data-mono text-[12px]" }, "Critical"),
                    el("button", { class: "flex-1 py-1 px-2 rounded bg-tertiary/20 text-tertiary text-data-mono font-data-mono text-[12px]" }, "High"),
                    el("button", { class: "flex-1 py-1 px-2 rounded bg-surface-container-high text-on-surface text-data-mono font-data-mono text-[12px]" }, "Medium")
                  )
                ),
                el("div", {},
                  el("label", { class: "text-data-mono font-data-mono text-[10px] uppercase text-on-surface-variant mb-2 block" }, "Asset Type"),
                  el("select", { class: "w-full bg-surface-container-low border border-outline-variant/20 rounded p-2 text-body-md font-body-md text-on-surface appearance-none" },
                    el("option", {}, "All Assets"),
                    el("option", {}, "Commercial HQ"),
                    el("option", {}, "Data Centers"),
                    el("option", {}, "Logistics Hubs")
                  )
                )
              )
            )
          )
        ),
        // Bottom: Layers
        el("div", { class: "bg-surface/80 backdrop-blur-xl shadow-xl rounded-xl p-[16px] flex flex-col gap-4 pointer-events-auto mb-[16px]" },
          el("span", { class: "text-data-mono font-data-mono text-[10px] uppercase tracking-widest text-outline" }, "Map Layers"),
          el("div", { class: "flex flex-col gap-2" },
            layerToggle("Thermal Gradient", "thermostat", "tertiary", true, "temperature"),
            layerToggle("Asset Overlay", "domain", "outline", false, "assets"),
            layerToggle("Air Quality", "air", "outline", false, "air"),
            layerToggle("CoolRoutes", "route", "outline", false, "routes")
          ),
          el("div", { class: "h-[1px] w-full bg-outline-variant/20 my-2" }),
          el("div", { class: "flex justify-between items-center" },
            el("span", { class: "text-data-mono font-data-mono text-[12px] text-on-surface-variant" }, "View Mode"),
            el("div", { class: "flex gap-1 bg-surface-container-low p-1 rounded-lg" },
              el("button", { class: "px-3 py-1 rounded bg-surface-container-high text-on-surface text-data-mono font-data-mono text-[12px] shadow-sm", onclick: () => setViewMode("map") }, "Map"),
              el("button", { class: "px-3 py-1 rounded text-on-surface-variant hover:text-on-surface text-data-mono font-data-mono text-[12px]", onclick: () => setViewMode("sat") }, "Sat")
            )
          )
        )
      ),

      // Right Side: Selected Location Panel (Floating)
      el("div", { class: "flex-1 flex justify-end items-start pointer-events-none" },
        el("div", { class: "w-96 bg-surface/80 backdrop-blur-xl shadow-2xl rounded-xl overflow-hidden pointer-events-auto transform transition-transform duration-300 hover:scale-[1.02]", id: "location-panel" },
          // Header / Image
          el("div", { class: "h-32 bg-cover bg-center relative", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAj64L0TO06y-mJ4X5x3nomHw_1Rpgke3WUVaFv4qjr_tMjKW_HsLdP6dHvSMDjSb8WRAIVQvMG3BOFLAJIGSP4Rwa4cH09zLy9xnLjxuzeUisa3pXWbdaCQaWn0yWzFXRZmjPgtxwabTllKkqHKP3TZw1bAf2zF5SsBP0VtNFDigWx6mIhlqIGTUJeD0f2-IOv2Qxb0rzvCW-0G1VmyxiyoUoZtD5CBTbO3CKPAHjEBzSsjTbIqDttLg')" },
            el("div", { class: "absolute inset-0 bg-gradient-to-t from-surface to-transparent" }),
            el("div", { class: "absolute bottom-4 left-4 right-4 flex justify-between items-end" },
              el("div", {},
                el("div", { class: "text-data-mono font-data-mono text-[10px] text-primary uppercase tracking-widest mb-1" }, "Selected Node"),
                el("div", { class: "text-headline-md font-headline-md text-on-surface leading-none", id: "selected-node-name" }, place?.display || "Select a location")
              ),
              el("div", { class: "bg-error text-on-error px-2 py-1 rounded text-data-mono font-data-mono text-[12px] shadow-[0_0_15px_rgba(255,180,171,0.5)]", id: "selected-node-status" }, "SELECT LOCATION")
            )
          ),
          // Content
          el("div", { class: "p-[16px] flex flex-col gap-6", id: "location-panel-content" },
            // Metrics Row
            el("div", { class: "grid grid-cols-2 gap-4", id: "metrics-row", style: "display: none;" },
              el("div", { class: "bg-surface-container-low p-3 rounded-lg border border-outline-variant/10" },
                el("span", { class: "text-data-mono font-data-mono text-[10px] text-outline uppercase block mb-1" }, "Surface Temp"),
                el("div", { class: "text-headline-lg font-headline-lg text-tertiary", id: "metric-temp" }, "\u2014"),
                el("span", { class: "text-data-mono font-data-mono text-[10px] text-error flex items-center mt-1", id: "metric-temp-trend" }, icon("trending_up", "text-[12px] mr-1"), "\u2014")
              ),
              el("div", { class: "bg-surface-container-low p-3 rounded-lg border border-outline-variant/10" },
                el("span", { class: "text-data-mono font-data-mono text-[10px] text-outline uppercase block mb-1" }, "Exposure Index"),
                el("div", { class: "text-headline-lg font-headline-lg text-on-surface", id: "metric-exposure" }, "\u2014"),
                el("span", { class: "text-data-mono font-data-mono text-[10px] text-on-surface-variant flex items-center mt-1", id: "metric-exposure-label" }, "\u2014")
              )
            ),
            // Graph Placeholder
            el("div", { id: "forecast-chart", style: "display: none;" },
              el("span", { class: "text-data-mono font-data-mono text-[10px] text-outline uppercase tracking-widest block mb-2" }, "48-Hour Forecast"),
              el("div", { class: "h-24 w-full relative" },
                el("svg", { class: "w-full h-full overflow-visible", preserveAspectRatio: "none", viewBox: "0 0 100 30" },
                  el("path", { class: "text-outline/30", d: "M0,25 Q10,25 20,20 T40,10 T60,15 T80,5 T100,2", fill: "none", stroke: "currentColor", "stroke-width": "0.5" }),
                  el("path", { class: "text-tertiary drop-shadow-[0_2px_4px_rgba(255,181,157,0.3)]", d: "M0,20 Q10,22 20,15 T40,5 T60,8 T80,2 T100,0", fill: "none", stroke: "currentColor", "stroke-width": "1.5" }),
                  el("circle", { class: "text-tertiary", cx: "40", cy: "5", fill: "currentColor", r: "1.5" }),
                  el("circle", { class: "text-error", cx: "80", cy: "2", fill: "currentColor", r: "1.5" })
                ),
                el("div", { class: "absolute inset-0 flex justify-between items-end text-data-mono font-data-mono text-[8px] text-on-surface-variant pt-2" },
                  el("span", {}, "Now"),
                  el("span", {}, "+12h"),
                  el("span", {}, "+24h"),
                  el("span", {}, "+36h"),
                  el("span", {}, "+48h")
                )
              )
            ),
            // Assets Affected
            el("div", { id: "assets-affected", style: "display: none;" },
              el("span", { class: "text-data-mono font-data-mono text-[10px] text-outline uppercase tracking-widest block mb-2" }, "Assets in Zone"),
              el("div", { class: "flex flex-col gap-2", id: "assets-list" }),
              el("button", { class: "w-full py-3 bg-tertiary text-on-tertiary font-headline-md text-[14px] uppercase tracking-wider rounded hover:bg-tertiary/90 transition-colors shadow-lg shadow-tertiary/20", id: "deploy-intervention-btn" }, "Deploy Intervention")
            )
          )
        )
      )
    ),
    // Floating Map Controls (Bottom Right)
    el("div", { class: "absolute bottom-[16px] right-[16px] flex flex-col gap-2 pointer-events-auto z-20" },
      mapControlBtn("add", "Zoom In", () => map?.zoomBy(1)),
      mapControlBtn("remove", "Zoom Out", () => map?.zoomBy(-1)),
      mapControlBtn("my_location", "My Location", () => map?.locateMe()),
      mapControlBtn("360", "Rotate", () => {})
    ),
    // Scale/Legend Overlay (Bottom Left)
    el("div", { class: "absolute bottom-[16px] left-80 ml-[16px] pointer-events-none flex flex-col gap-1" },
      el("div", { class: "h-2 w-48 bg-gradient-to-r from-surface-container via-tertiary to-error rounded-full opacity-80" }),
      el("div", { class: "flex justify-between w-48 text-data-mono font-data-mono text-[10px] text-on-surface shadow-sm px-1 rounded bg-surface/50 backdrop-blur" },
        el("span", {}, "20\u00b0C"),
        el("span", {}, "Risk Gradient"),
        el("span", {}, "50\u00b0C+")
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-explorer");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: place ? [place.lat, place.lon] : [25.7743, -80.1937], zoom: 4 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid, { onClick: handleTileClick });
      }
      setupSearch();
      setupLayerToggles();
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context && state.context.heatmap) {
      if (state.gridLayer) {
        loadGridLayer(state.place?.id, state.gridLayer).catch(() => {});
      }
    }
  });
}

function layerToggle(label, iconName, iconColor, active, layerKey) {
  return el("label", { class: "flex items-center justify-between p-2 rounded hover:bg-surface-container-highest cursor-pointer transition-colors group" },
    el("div", { class: "flex items-center gap-3" },
      icon(iconName, `text-[20px] text-${iconColor}`),
      el("span", { class: "text-body-md font-body-md text-on-surface group-hover:text-tertiary transition-colors" }, label)
    ),
    el("div", { class: `w-10 h-5 rounded-full relative shadow-inner ${active ? "bg-tertiary" : "bg-surface-container-high"} border ${active ? "border-transparent" : "border-outline-variant/20"}`, id: `layer-toggle-${layerKey}`, onclick: () => toggleLayer(layerKey) },
      el("div", { class: `absolute ${active ? "right-1" : "left-1"} top-1 w-3 h-3 bg-${active ? "on-tertiary" : "outline"} rounded-full shadow transition-transform duration-200` })
    )
  );
}

function mapControlBtn(iconName, title, action) {
  return el("button", { class: "w-10 h-10 bg-surface/80 backdrop-blur shadow-md rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant/10", title, onclick: action }, icon(iconName));
}

function setupSearch() {
  const input = document.getElementById("map-search-input");
  if (!input) return;
  let searchTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) return;
    searchTimer = setTimeout(async () => {
      try {
        const { results } = await geoSearch(q);
        if (results.length) {
          const place = results[0];
          await loadContextFor(place.id);
          toast(`Location set: ${place.display}`, "success");
        }
      } catch (err) {
        toast("Search failed", "error");
      }
    }, 280);
  });
}

function setupLayerToggles() {
  ["temperature", "assets", "air", "routes"].forEach(key => {
    const el = document.getElementById(`layer-toggle-${key}`);
    if (el) {
      el.onclick = () => toggleLayer(key);
    }
  });
}

function toggleLayer(layerKey) {
  const st = getState();
  const active = st.gridLayer === layerKey;
  const btn = document.getElementById(`layer-toggle-${layerKey}`);
  
  if (layerKey === "temperature") {
    setState({ gridLayer: "temperature" });
    if (st.place) loadGridLayer(st.place.id, "temperature", { force: true });
  } else if (layerKey === "assets") {
    // Toggle asset overlay
    toast("Asset overlay toggled", "info");
  } else if (layerKey === "air") {
    toast("Air quality layer toggled", "info");
  } else if (layerKey === "routes") {
    toast("CoolRoutes layer toggled", "info");
  }
  
  if (btn) {
    const knob = btn.querySelector("div");
    const iconEl = btn.querySelector(".material-symbols-outlined");
    if (active) {
      btn.classList.remove("bg-tertiary");
      btn.classList.add("bg-surface-container-high", "border", "border-outline-variant/20");
      if (knob) { knob.style.left = ""; knob.style.right = "1px"; knob.classList.remove("bg-on-tertiary"); knob.classList.add("bg-outline"); }
      if (iconEl) iconEl.classList.remove("text-tertiary");
    } else {
      btn.classList.add("bg-tertiary");
      btn.classList.remove("bg-surface-container-high", "border", "border-outline-variant/20");
      if (knob) { knob.style.right = "1px"; knob.style.left = ""; knob.classList.add("bg-on-tertiary"); knob.classList.remove("bg-outline"); }
      if (iconEl) iconEl.classList.add("text-tertiary");
    }
  }
}

function handleTileClick(tile) {
  if (!tile) return;
  
  const panel = document.getElementById("location-panel");
  const nameEl = document.getElementById("selected-node-name");
  const statusEl = document.getElementById("selected-node-status");
  const metricsRow = document.getElementById("metrics-row");
  const forecastChart = document.getElementById("forecast-chart");
  const assetsAffected = document.getElementById("assets-affected");
  const assetsList = document.getElementById("assets-list");
  const metricTemp = document.getElementById("metric-temp");
  const metricTempTrend = document.getElementById("metric-temp-trend");
  const metricExposure = document.getElementById("metric-exposure");
  const metricExposureLabel = document.getElementById("metric-exposure-label");
  
  if (nameEl) nameEl.textContent = `Tile ${tile.id} @ ${tile.center?.lat?.toFixed(3)}, ${tile.center?.lon?.toFixed(3)}`;
  if (statusEl) {
    statusEl.textContent = tile.layer?.band || "UNKNOWN";
    statusEl.className = `px-2 py-1 rounded text-data-mono font-data-mono text-[12px] shadow-[0_0_15px_rgba(255,180,171,0.5)] ${getStatusClass(tile.layer?.band)}`;
  }
  if (metricsRow) metricsRow.style.display = "grid";
  if (forecastChart) forecastChart.style.display = "block";
  if (assetsAffected) assetsAffected.style.display = "block";
  
  if (metricTemp) metricTemp.textContent = tile.value != null ? `${tile.value.toFixed(1)}\u00b0C` : "\u2014";
  if (metricTempTrend) metricTempTrend.innerHTML = `${icon("trending_up", "text-[12px] mr-1")} \u2014`;
  if (metricExposure) metricExposure.textContent = tile.layer?.band ? `${getExposureIndex(tile.layer.band)}/100` : "\u2014";
  if (metricExposureLabel) metricExposureLabel.textContent = tile.layer?.band ? getVulnerabilityLabel(tile.layer.band) : "\u2014";
  
  // Update assets list
  if (assetsList) {
    const st = getState();
    const assets = st.context?.assets || [];
    const nearby = assets.filter(a => a.risk && a.risk.index >= 3).slice(0, 3);
    assetsList.innerHTML = "";
    nearby.forEach(a => {
      assetsList.appendChild(el("div", { class: "flex items-center justify-between p-2 bg-surface-container-lowest rounded border border-outline-variant/10" },
        el("div", { class: "flex items-center gap-2" },
          icon(a.category === "energy" ? "bolt" : a.category === "logistics" ? "warehouse" : "dns", "text-[16px] text-on-surface-variant"),
          el("span", { class: "text-data-mono font-data-mono text-[12px] text-on-surface" }, a.name)
        ),
        el("span", { class: `w-2 h-2 rounded-full ${a.risk.index >= 4 ? "bg-error animate-pulse" : "bg-tertiary"}` })
      ));
    });
  }
}

function getStatusClass(band) {
  const classes = { Critical: "bg-error text-on-error", High: "bg-tertiary text-on-tertiary", Elevated: "bg-tertiary text-on-tertiary", Moderate: "bg-amber-500 text-white", Low: "bg-primary text-on-primary" };
  return classes[band] || "bg-outline text-on-surface";
}

function getExposureIndex(band) {
  const map = { Critical: 95, High: 85, Elevated: 70, Moderate: 50, Low: 30 };
  return map[band] || 0;
}

function getVulnerabilityLabel(band) {
  const labels = { Critical: "Critical Vulnerability", High: "High Vulnerability", Elevated: "Elevated Vulnerability", Moderate: "Moderate Vulnerability", Low: "Low Vulnerability" };
  return labels[band] || "Unknown";
}

function setViewMode(mode) {
  toast(`View mode: ${mode}`, "info");
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
}
