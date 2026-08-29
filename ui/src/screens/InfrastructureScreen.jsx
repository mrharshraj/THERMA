// Infrastructure & Utilities Screen (from ui/infrastructure_utilities/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, clearGrid, addMarker, clearMarkers } from "../lib/map.js";
import { el, icon, toast, tempF, severityChip, lineChart } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;
let selectedAsset = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;
  const assets = ctx?.assets || [];

  const main = el("main", { class: "flex h-full" },
    // Main Map Area
    el("div", { class: "flex-1 relative h-full" },
      el("div", { id: "map-infrastructure", class: "absolute inset-0 z-0" }),
      // Map Overlay Controls
      el("div", { class: "absolute left-[32px] top-[32px] flex flex-col gap-4 z-10" },
        el("div", { class: "bg-surface/80 backdrop-blur-md rounded-xl p-2 shadow-lg shadow-surface-dim flex flex-col gap-2" },
          mapControlBtn("electric_bolt", "Power Grid", true, () => filterAssets("energy")),
          mapControlBtn("water_drop", "Water Systems", false, () => filterAssets("water")),
          mapControlBtn("directions_transit", "Transit", false, () => filterAssets("transport")),
          el("div", { class: "h-px w-full bg-outline-variant/30 my-1" }),
          mapControlBtn("layers", "Layers", false, () => {})
        )
      ),
      // Floating Asset Info (Map Hover State Mock)
      el("div", { class: "absolute top-[30%] left-[45%] z-20" },
        assetHoverCard("Substation Alpha-9", "Critical Heat Stress", "112°F", "error")
      ),
      el("div", { class: "absolute top-[50%] left-[65%] z-20" },
        assetHoverCard("Pump Station Beta", "Nominal", "88°F", "primary")
      ),
      el("div", { class: "absolute top-[60%] left-[25%] z-20" },
        assetHoverCard("Transit Hub Gamma", "Elevated", "98°F", "tertiary")
      ),
      // Risk Distribution Overlay
      el("div", { class: "absolute bottom-[32px] left-[32px] right-[32px] bg-surface/85 backdrop-blur-xl rounded-2xl shadow-xl p-6 flex flex-col md:flex-row gap-8 items-center z-10" },
        el("div", { class: "flex-1 w-full" },
          el("h3", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-2" }, "Grid Health"),
          el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-md" }, "Real-time heat stress distribution across monitored infrastructure nodes.")
        ),
        el("div", { class: "flex gap-8 w-full md:w-auto" },
          riskRing("Critical", "15%", "error", 0.15),
          riskRing("Elevated", "40%", "tertiary", 0.4),
          riskRing("Nominal", "45%", "primary", 0.45)
        )
      )
    ),

    // Right Side Panel: Asset Details
    el("div", { class: "w-[480px] bg-surface-container-low h-full flex flex-col overflow-y-auto shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20" },
      // Selected Asset Header
      el("div", { class: "p-8 pb-6 bg-surface-container", id: "asset-header" },
        el("div", { class: "flex justify-between items-start mb-6" },
          el("div", {},
            el("div", { class: "font-data text-[10px] text-outline font-bold uppercase tracking-widest mb-2" }, "Selected Asset"),
            el("h2", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface", id: "asset-name" }, place?.display || "Select Asset")
          ),
          el("div", { class: "bg-error/10 text-error px-3 py-1 rounded-full font-data text-[12px] font-bold flex items-center gap-1", id: "asset-status" },
            icon("warning", "text-[16px]"),
            "SELECT ASSET"
          )
        ),
        el("div", { class: "grid grid-cols-2 gap-4" },
          statBox("Current Temp", "\u2014", "\u00b0F", "error", "\u2014"),
          statBox("Stress Load", "\u2014", "%", "on-surface", "\u2014")
        )
      ),
      // Heat Trend Chart
      el("div", { class: "p-8 py-6", id: "trend-chart" },
        el("div", { class: "flex justify-between items-end mb-4" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "24h Heat Profile"),
          el("div", { class: "font-data text-[12px] text-on-surface-variant" }, "Forecast: ", el("span", { class: "text-tertiary" }, "Peaking at 115°F"))
        ),
        el("div", { class: "h-32 w-full relative", id: "heat-trend-canvas" })
      ),
      // Priority List
      el("div", { class: "flex-1 p-8 pt-0", id: "priority-list" },
        el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4" }, "Priority Actions"),
        el("div", { class: "flex flex-col gap-3" },
          actionItem("ac_unit", "Deploy Portable Cooling", "Dispatch mobile HVAC units to Transformer Bay C to prevent thermal trip.", "error", "URGENT"),
          actionItem("reduce_capacity", "Load Shedding Protocol", "Prepare to reroute 15MW of load to adjacent substations within 2 hours.", "tertiary", "PENDING")
        )
      ),
      // Bottom Action
      el("div", { class: "p-6 bg-surface-container-high shrink-0" },
        el("button", { class: "w-full py-4 bg-primary text-on-primary font-headline text-body rounded-xl hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/10", onclick: () => toast("Issuing regional alert...", "info") },
          icon("campaign", "text-[20px]"),
          "Issue Regional Alert"
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-infrastructure");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: place ? [place.lat, place.lon] : [34.0522, -118.2437], zoom: 10 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid, { onClick: handleTileClick });
      }
      // Add infrastructure markers
      const infraAssets = ctx?.assets?.filter(a => ["energy", "water", "transport", "communications"].includes(a.category)) || [];
      infraAssets.forEach(a => addMarker({ lat: a.lat, lon: a.lon, label: a.name, category: a.category, color: a.risk?.index >= 4 ? "#ffb4ab" : a.risk?.index === 3 ? "#ffb59d" : "#c8c6c5" }));
      renderHeatTrendChart();
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      loadGridLayer(state.place?.id, state.gridLayer).catch(() => {});
    }
  });
}

function mapControlBtn(iconName, label, active, action) {
  return el("button", { class: `w-10 h-10 flex items-center justify-center rounded-lg ${active ? "bg-primary text-on-primary shadow-md hover:bg-primary-fixed" : "text-on-surface hover:bg-surface-container-high"} transition-colors`, onclick: action, title: label }, icon(iconName));
}

function assetHoverCard(name, status, temp, color) {
  return el("div", { class: "relative group cursor-pointer" },
    el("div", { class: `w-12 h-12 rounded-full bg-${color}/20 flex items-center justify-center animate-pulse` },
      el("div", { class: `w-4 h-4 rounded-full bg-${color} shadow-[0_0_15px_rgba(255,180,171,0.8)] ring-2 ring-surface` })
    ),
    el("div", { class: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" },
      el("div", { class: "bg-surface-container-highest p-3 rounded-lg shadow-xl relative" },
        el("div", { class: "font-data text-[10px] text-error mb-1 font-bold uppercase" }, status),
        el("div", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-1 truncate" }, name),
        el("div", { class: "flex items-center gap-2" }, icon("thermostat", "text-[14px] text-on-surface-variant"), el("span", { class: "font-data text-on-surface" }, "112°F")),
        el("div", { class: "absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-surface-container-highest" })
      )
    )
  );
}

function riskRing(label, value, color, progress) {
  return el("div", { class: "flex flex-col items-center" },
    el("svg", { class: "w-20 h-20 -rotate-90 transform", viewBox: "0 0 100 100" },
      el("circle", { class: "text-surface-container-highest", cx: "50", cy: "50", fill: "none", r: "40", stroke: "currentColor", "stroke-width": "8" }),
      el("circle", { class: `text-${color}`, cx: "50", cy: "50", fill: "none", r: "40", stroke: "currentColor", "stroke-dasharray": "251.2", "stroke-dashoffset": (251.2 * (1 - progress)).toFixed(2), "stroke-linecap": "round", "stroke-width": "8" })
    ),
    el("div", { class: "mt-2 text-center" },
      el("div", { class: `font-data text-data-mono text-${color} font-bold` }, value),
      el("div", { class: "font-data text-[10px] text-on-surface-variant uppercase" }, label)
    )
  );
}

function statBox(label, value, unit, color, trend) {
  return el("div", { class: "bg-surface-container-highest p-4 rounded-xl" },
    el("div", { class: "font-data text-[10px] text-on-surface-variant uppercase mb-1" }, label),
    el("div", { class: `font-headline text-[32px] leading-[40px] text-${color} flex items-baseline gap-1` }, value, el("span", { class: "font-body text-body text-on-surface-variant" }, unit)),
    trend !== "\u2014" ? el("div", { class: "flex items-center gap-1 mt-2 text-error" }, icon("trending_up", "text-[14px]"), el("span", { class: "font-data text-[10px]" }, trend)) : null
  );
}

function actionItem(iconName, title, desc, color, status) {
  return el("div", { class: "bg-surface p-4 rounded-xl flex items-start gap-4 group hover:-translate-y-1 transition-transform cursor-pointer shadow-sm" },
    el("div", { class: `w-10 h-10 rounded-full bg-${color}/10 flex items-center justify-center shrink-0` }, icon(iconName, `text-${color} text-[20px]`)),
    el("div", { class: "flex-1 min-w-0" },
      el("div", { class: "flex justify-between items-center mb-1" },
        el("div", { class: "font-body font-bold text-on-surface truncate" }, title),
        el("span", { class: `font-data text-[10px] text-${color} bg-${color}/10 px-2 py-0.5 rounded` }, status)
      ),
      el("p", { class: "font-body text-[14px] text-on-surface-variant line-clamp-2" }, desc)
    )
  );
}

function handleTileClick(tile) {
  if (!tile) return;
  
  const asset = getState().context?.assets?.find(a => a.id === `asset-${tile.id}`) || { name: `Asset ${tile.id}`, category: "energy", tempC: tile.value, risk: tile.layer };
  updateAssetPanel(asset);
}

function updateAssetPanel(asset) {
  const nameEl = document.getElementById("asset-name");
  const statusEl = document.getElementById("asset-status");
  const tempEl = document.getElementById("asset-header")?.querySelector(".grid.grid-cols-2");
  
  if (nameEl) nameEl.textContent = asset.name;
  if (statusEl) {
    statusEl.innerHTML = `${icon("warning", "text-[16px]")} ${asset.risk?.band || "UNKNOWN"}`;
    statusEl.className = `bg-${getRiskColor(asset.risk?.band)}/10 text-${getRiskColor(asset.risk?.band)} px-3 py-1 rounded-full font-data text-[12px] font-bold flex items-center gap-1`;
  }
  if (tempEl) {
    tempEl.innerHTML = `
      <div class="bg-surface-container-highest p-4 rounded-xl">
        <div class="font-data text-[10px] text-on-surface-variant uppercase mb-1">Current Temp</div>
        <div class="font-headline text-[32px] text-error flex items-baseline gap-1">${asset.tempC ? asset.tempC.toFixed(0) : "112"}<span class="font-body text-on-surface-variant">°F</span></div>
        <div class="flex items-center gap-1 mt-2 text-error">? +4°F / hr</div>
      </div>
      <div class="bg-surface-container-highest p-4 rounded-xl">
        <div class="font-data text-[10px] text-on-surface-variant uppercase mb-1">Stress Load</div>
        <div class="font-headline text-[32px] text-on-surface flex items-baseline gap-1">${asset.risk?.index ? asset.risk.index * 10 + 5 : "94"}<span class="font-body text-on-surface-variant">%</span></div>
        <div class="w-full h-1 bg-surface mt-3 rounded-full overflow-hidden">
          <div class="h-full bg-error" style="width: 94%"></div>
        </div>
      </div>
    `;
  }
}

function getRiskColor(band) {
  const colors = { Critical: "error", High: "error", Elevated: "tertiary", Moderate: "tertiary", Low: "primary", Minimal: "primary" };
  return colors[band] || "primary";
}

function renderHeatTrendChart() {
  const container = document.getElementById("heat-trend-canvas");
  if (!container) return;

  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.innerHTML = "";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const cw = w - padding.left - padding.right;
  const ch = h - padding.top - padding.bottom;

  // Mock 24h data
  const data = Array.from({ length: 24 }, (_, i) => Math.random() * 20 + 90);
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);

  // Grid lines
  ctx.strokeStyle = "#444748";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = padding.top + (i / 3) * ch;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  // Area fill
  ctx.fillStyle = "#ffb4ab33";
  ctx.beginPath();
  ctx.moveTo(padding.left, h - padding.bottom);
  data.forEach((val, i) => {
    const x = padding.left + (i / 23) * (w - padding.left - padding.right);
    const y = padding.top + ch * (1 - (val - minVal) / (maxVal - minVal));
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(w - padding.right, h - padding.bottom);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = "#ffb4ab";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = padding.left + (i / 23) * (w - padding.left - padding.right);
    const y = padding.top + ch * (1 - (val - minVal) / (maxVal - minVal));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Current point
  const nowX = padding.left + (14 / 23) * (w - padding.left - padding.right);
  const nowY = padding.top + ch * (1 - (data[14] - minVal) / (maxVal - minVal));
  ctx.fillStyle = "#ffb4ab";
  ctx.beginPath();
  ctx.arc(nowX, nowY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffb4ab33";
  ctx.beginPath();
  ctx.arc(nowX, nowY, 12, 0, Math.PI * 2);
  ctx.fill();

  // Time labels
  ctx.fillStyle = "#c4c7c7";
  ctx.font = "10px Geist, monospace";
  ctx.textAlign = "center";
  ["12AM", "6AM", "12PM", "Now", "12AM"].forEach((label, i) => {
    const x = padding.left + (i / 4) * (w - padding.left - padding.right);
    ctx.fillStyle = i === 3 ? "#ffb59d" : "#c4c7c7";
    ctx.font = i === 3 ? "bold 10px Geist, monospace" : "10px Geist, monospace";
    ctx.fillText(label, x, h - padding.bottom + 20);
  });
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
  clearMarkers();
}
