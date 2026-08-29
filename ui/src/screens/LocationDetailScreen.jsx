// Location Detail Screen (from ui/location_intelligence_profile/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer, loadEnvironmentFor, getRoutes } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, clearGrid, focusPlace, addMarker, clearMarkers } from "../lib/map.js";
import { el, icon, toast, tempF, severityChip } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;
  const env = ctx?.environment?.current;
  const assets = ctx?.assets || [];

  const param = route.param;
  const assetId = param?.replace("asset:", "");

  const main = el("main", { class: "relative flex-1 h-[calc(100vh-64px)] overflow-hidden" },
    // Map Background
    el("div", { class: "absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[10s] hover:scale-105", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFh4IJew5lawZd7SiS7f0NCHUSWMwGXoc7QUMawwk2UgxWIdkU7lGUxVAtoQ42c3Ho3m-8qiKXfYt8e1rhBh92a6U40DIRW1SsU7egAefqj701HQ-gsYLqN4VkdHl78M4C6lK9TjkvoavyDjXOoYGykgRTTI02YUlMWpUYILLCXxuc69lfkireyhJsHfwyb4qTmreZLk5O-ah-8nqmJXIkRqHXtpNMQWSgDVENoKIEIByTlmQX6iuD0A')" }),
    // Gradient Scrim for Contrast
    el("div", { class: "absolute inset-0 z-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent pointer-events-none" }),
    el("div", { class: "absolute inset-0 z-0 bg-gradient-to-t from-background/90 via-transparent to-transparent pointer-events-none" }),
    // Interface Overlay
    el("div", { class: "relative z-10 flex flex-1 w-full p-[32px] gap-[16px] overflow-hidden pointer-events-none" },
      // Left Analytical Panel
      el("div", { class: "w-[460px] flex flex-col gap-[16px] shrink-0 h-full overflow-y-auto pointer-events-auto pr-2 custom-scrollbar" },
        // Header Identity
        el("div", { class: "flex flex-col bg-surface-container/80 backdrop-blur-xl p-6 rounded-xl shadow-2xl" },
          el("div", { class: "flex items-start justify-between mb-4" },
            el("div", {},
              el("div", { class: "font-data text-data-mono text-primary mb-1 uppercase tracking-widest", id: "zone-label" }, "Southwest Sector \u2022 Grid 7A"),
              el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface mb-2", id: "location-name" }, place?.display || "PHOENIX, AZ")
            ),
            el("div", { class: "flex flex-col items-end" },
              el("div", { class: "font-data text-[10px] text-on-surface-variant uppercase mb-1" }, "Status"),
              el("div", { class: "bg-error px-3 py-1 rounded-full shadow-lg shadow-error/20", id: "location-status" },
                el("span", { class: "font-data text-data-mono text-on-error font-bold tracking-tight" }, ctx?.exposure?.level === "Critical" ? "CRITICAL" : "MONITORED")
              )
            )
          ),
          el("div", { class: "flex gap-4 items-end" },
            el("div", { class: "flex flex-col" },
              el("span", { class: "font-data text-[10px] text-on-surface-variant uppercase mb-1" }, "Current Temp"),
              el("div", { class: "flex items-baseline gap-1 text-error", id: "current-temp" },
                el("span", { class: "font-display text-[48px] leading-[56px]" }, env?.temperatureC ? Math.round(env.temperatureC * 9/5 + 32) : 114),
                el("span", { class: "font-headline text-[24px]" }, "\u00b0F")
              )
            ),
            el("div", { class: "w-px h-12 bg-on-surface-variant/20 mx-2" }),
            el("div", { class: "flex flex-col" },
              el("span", { class: "font-data text-[10px] text-on-surface-variant uppercase mb-1" }, "Risk Index"),
              el("div", { class: "flex items-baseline gap-1 text-on-surface", id: "risk-index" },
                el("span", { class: "font-headline text-[32px] leading-[40px]" }, ctx?.exposure?.score || 94),
                el("span", { class: "font-data text-data-mono text-on-surface-variant" }, "/100")
              )
            )
          )
        ),
        // Telemetry Grid
        el("div", { class: "grid grid-cols-2 gap-[16px]" },
          // Heat Exposure
          el("div", { class: "flex flex-col bg-surface-container-low/90 backdrop-blur-lg p-5 rounded-xl shadow-xl group hover:bg-surface-container/90 transition-colors cursor-pointer" },
            el("div", { class: "flex items-center gap-2 mb-3" },
              icon("wb_sunny", "text-tertiary text-[20px]"),
              el("h3", { class: "font-data text-[10px] text-outline uppercase tracking-widest" }, "Exposure")
            ),
            el("div", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-1", id: "exposure-time" }, "18\u00a0<span class=\"text-body text-on-surface-variant\">mins</span>"),
            el("div", { class: "font-data text-[10px] text-error mb-4" }, "Max safe duration"),
            // Sparkline
            el("div", { class: "mt-auto h-12 w-full relative" },
              el("svg", { class: "w-full h-full overflow-visible preserve-3d", viewBox: "0 0 100 30" },
                el("path", { class: "text-tertiary opacity-50", d: "M0,25 Q10,20 20,22 T40,15 T60,5 T80,10 T100,2", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-width": "2" }),
                el("path", { class: "text-tertiary drop-shadow-[0_4px_4px_rgba(255,181,157,0.4)]", d: "M0,25 Q10,20 20,22 T40,15 T60,5 T80,10 T100,2", fill: "none", stroke: "currentColor", "stroke-dasharray": "150", "stroke-dashoffset": "150", "stroke-linecap": "round", "stroke-width": "2" }),
                el("circle", { class: "text-tertiary", cx: "100", cy: "2", fill: "currentColor", r: "3" })
              )
            )
          ),
          // Environment
          el("div", { class: "flex flex-col bg-surface-container-low/90 backdrop-blur-lg p-5 rounded-xl shadow-xl group hover:bg-surface-container/90 transition-colors cursor-pointer" },
            el("div", { class: "flex items-center gap-2 mb-3" },
              icon("air", "text-primary text-[20px]"),
              el("h3", { class: "font-data text-[10px] text-outline uppercase tracking-widest" }, "Environment")
            ),
            el("div", { class: "flex-1 flex items-center justify-center relative my-2" },
              el("svg", { class: "w-16 h-16 transform -rotate-90", viewBox: "0 0 64 64" },
                el("circle", { class: "text-surface-container-highest", cx: "32", cy: "32", fill: "none", r: "28", stroke: "currentColor", "stroke-width": "6" }),
                el("circle", { class: "text-error", cx: "32", cy: "32", fill: "none", r: "28", stroke: "currentColor", "stroke-dasharray": "175.93", "stroke-dashoffset": "40", "stroke-linecap": "round", "stroke-width": "6" })
              ),
              el("div", { class: "absolute inset-0 flex flex-col items-center justify-center" },
                el("span", { class: "font-headline text-[24px] text-on-surface", id: "aqi-value" }, env?.aqi || 142)
              )
            ),
            el("div", { class: "text-center font-data text-[10px] text-on-surface-variant uppercase mt-2", id: "aqi-label" }, "AQI (Unhealthy)")
          )
        ),
        // Alerts
        el("div", { class: "flex flex-col bg-surface-container/80 backdrop-blur-xl p-5 rounded-xl shadow-xl" },
          el("div", { class: "flex items-center justify-between mb-4" },
            el("div", { class: "flex items-center gap-2" },
              icon("warning", "text-error text-[20px]"),
              el("h3", { class: "font-data text-data-mono text-on-surface uppercase tracking-widest" }, "Active Alerts")
            ),
            el("span", { class: "bg-error-container text-on-error-container font-data text-[10px] px-2 py-0.5 rounded-full", id: "alert-count" }, ctx?.alerts?.length || 3)
          ),
          el("div", { class: "flex flex-col gap-3", id: "alerts-list" },
            ...(ctx?.alerts || []).slice(0, 2).map(a => alertItem(a))
          )
        ),
        // Recommendations
        el("div", { class: "flex flex-col bg-surface-container/80 backdrop-blur-xl p-5 rounded-xl shadow-xl mt-auto" },
          el("div", { class: "flex items-center gap-2 mb-4" },
            icon("rule", "text-primary text-[20px]"),
            el("h3", { class: "font-data text-data-mono text-on-surface uppercase tracking-widest" }, "Directives")
          ),
          el("div", { class: "flex flex-col gap-2" },
            directiveBtn("Reroute non-essential logistics"),
            directiveBtn("Deploy auxiliary cooling to Substation Delta")
          )
        )
      ),

      // Right Side layout (Map clear + Actions + Bottom panels)
      el("div", { class: "flex-1 flex flex-col justify-between items-end pointer-events-none" },
        // Top Actions
        el("div", { class: "flex gap-3 pointer-events-auto" },
          actionBtn("analytics", "Analyze", "primary"),
          actionBtn("compare_arrows", "Compare", "primary"),
          actionBtn("route", "Find Route", "tertiary", true, "bg-on-tertiary-container text-tertiary-container hover:bg-tertiary shadow-[0_0_20px_rgba(225,71,0,0.3)]")
        ),
        // Bottom Floating Panels
        el("div", { class: "w-full flex gap-[16px] items-end pointer-events-auto" },
          // Asset Monitor
          el("div", { class: "flex-1 bg-surface-container/80 backdrop-blur-xl p-5 rounded-xl shadow-2xl flex flex-col h-[240px]" },
            el("div", { class: "flex items-center justify-between mb-4" },
              el("div", { class: "flex items-center gap-2" },
                icon("precision_manufacturing", "text-primary text-[20px]"),
                el("h3", { class: "font-data text-data-mono text-on-surface uppercase tracking-widest" }, "Asset Impact")
              ),
              el("button", { class: "font-data text-[10px] text-primary hover:text-on-surface transition-colors uppercase" }, "View All")
            ),
            el("div", { class: "flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar" },
              assetImpactItem("Substation Delta", "SUB-842-AZ", "95% Load", "At risk", "error", true),
              assetImpactItem("Fleet Hub West", "FLT-91-PHX", "110\u00b0F Ambient", "Monitor", "tertiary"),
              assetImpactItem("Data Center PHX-1", "DC-001-AZ", "Normal", "Stable", "primary")
            )
          ),
          // 24h Trend Graph
          el("div", { class: "w-[400px] bg-surface-container/90 backdrop-blur-xl p-5 rounded-xl shadow-2xl flex flex-col h-[240px]" },
            el("div", { class: "flex items-center justify-between mb-4" },
              el("div", { class: "flex items-center gap-2" },
                icon("show_chart", "text-primary text-[20px]"),
                el("h3", { class: "font-data text-data-mono text-on-surface uppercase tracking-widest" }, "48h Trend")
              ),
              el("div", { class: "flex gap-2" },
                el("span", { class: "w-1 h-3 bg-error rounded-full" }),
                el("span", { class: "w-1 h-3 bg-tertiary rounded-full" }),
                el("span", { class: "w-1 h-3 bg-primary rounded-full" })
              )
            ),
            el("div", { class: "flex-1 w-full relative", id: "trend-chart" })
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.querySelector("main > div.absolute.inset-0.z-0.bg-cover");
    if (mapContainer && !mapMounted) {
      const mapDiv = el("div", { id: "map-location", class: "absolute inset-0" });
      mapContainer.parentNode.insertBefore(mapDiv, mapContainer.nextSibling);
      const map = mountMap(mapDiv, { center: place ? [place.lat, place.lon] : [33.4484, -112.074], zoom: 10 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid);
      }
      renderTrendChart();
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      loadGridLayer(state.place?.id, state.gridLayer).catch(() => {});
    }
  });
}

function alertItem(a) {
  return el("div", { class: "flex gap-3 bg-surface-container-highest/50 p-3 rounded-lg relative overflow-hidden" },
    el("div", { class: `absolute left-0 top-0 bottom-0 w-1 ${a.severity === "Critical" ? "bg-error" : "bg-tertiary"}` }),
    icon(a.severity === "Critical" ? "local_fire_department" : "bolt", `${a.severity === "Critical" ? "text-error" : "text-tertiary"} text-[18px] mt-0.5`),
    el("div", {},
      el("div", { class: "font-headline text-[14px] text-on-surface mb-0.5" }, a.type || "Alert"),
      el("div", { class: "font-body text-[12px] text-on-surface-variant" }, a.description || "")
    )
  );
}

function directiveBtn(text) {
  return el("button", { class: "flex items-center justify-between w-full p-3 bg-surface-container-low hover:bg-surface-container-highest transition-colors rounded-lg text-left group" },
    el("span", { class: "font-body text-on-surface text-[14px]" }, text),
    icon("arrow_forward", "text-on-surface-variant group-hover:text-primary text-[18px]")
  );
}

function actionBtn(iconName, label, color, prominent = false, extraClass = "") {
  return el("button", { class: `h-12 px-6 flex items-center justify-center gap-2 bg-surface-container/90 backdrop-blur-md text-on-surface hover:bg-surface-container-highest rounded-full shadow-lg transition-all group ${extraClass} ${prominent ? "" : ""}` },
    icon(iconName, `text-[20px] ${color === "primary" ? "text-primary" : color === "tertiary" ? "text-tertiary" : ""} group-hover:scale-110 transition-transform`),
    el("span", { class: "font-data text-[12px] uppercase tracking-widest font-bold" }, label)
  );
}

function assetImpactItem(name, id, status, label, color, pulse = false) {
  return el("div", { class: "flex items-center justify-between p-3 bg-surface-container-low/50 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer group" },
    el("div", { class: "flex items-center gap-3" },
      el("div", { class: `w-2 h-2 rounded-full ${color === "error" ? "bg-error animate-pulse" : color === "tertiary" ? "bg-tertiary" : "bg-primary"}` }),
      el("div", { class: "flex flex-col" },
        el("span", { class: "font-body text-on-surface text-[14px]" }, name),
        el("span", { class: "font-data text-[10px] text-on-surface-variant" }, `ID: ${id}`)
      )
    ),
    el("div", { class: "flex flex-col items-end" },
      el("span", { class: `font-data text-[12px] text-${color}` }, status),
      el("span", { class: "font-data text-[10px] text-on-surface-variant" }, label)
    )
  );
}

function renderTrendChart() {
  const container = document.getElementById("trend-chart");
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

  // Mock data
  const data = Array.from({ length: 48 }, (_, i) => Math.sin(i / 4) * 5 + 40);
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);

  // Grid lines
  ctx.strokeStyle = "#444748";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  // Baseline
  ctx.strokeStyle = "#c4c7c7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + ch * 0.5);
  ctx.lineTo(w - padding.right, padding.top + ch * 0.5);
  ctx.stroke();

  // Area fill
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  gradient.addColorStop(0, "#ffb4ab");
  gradient.addColorStop(1, "#ffb4ab00");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(padding.left, h - padding.bottom);
  data.forEach((val, i) => {
    const x = padding.left + (i / 47) * cw;
    const y = padding.top + ch * (1 - (val - Math.min(...data)) / (Math.max(...data) - Math.min(...data)));
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
    const x = padding.left + (i / 47) * cw;
    const y = padding.top + ch * (1 - (val - Math.min(...data)) / (Math.max(...data) - Math.min(...data)));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Peak points
  const peakIdx = data.indexOf(Math.max(...data));
  const peakX = padding.left + (peakIdx / 47) * cw;
  const peakY = padding.top + ch * (1 - (data[peakIdx] - Math.min(...data)) / (Math.max(...data) - Math.min(...data)));
  ctx.fillStyle = "#ffb4ab";
  ctx.beginPath();
  ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "#ffb4ab";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  // X Axis Labels
  ctx.fillStyle = "#c4c7c7";
  ctx.font = "8px Geist, monospace";
  ctx.textAlign = "center";
  ["00:00", "12:00", "16:00", "24:00"].forEach((label, i) => {
    const x = padding.left + (i / 3) * cw;
    ctx.fillStyle = i === 2 ? "#ffb4ab" : "#c4c7c7";
    ctx.font = i === 2 ? "bold 8px Geist, monospace" : "8px Geist, monospace";
    ctx.fillText(label, x, h - padding.bottom + 20);
  });
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
  clearMarkers();
}
