// Heat Intelligence Screen (from ui/heat_intelligence_analysis/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer, loadEnvironmentFor, geoSearch, geoPlaces } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, focusPlace, clearGrid } from "../lib/map.js";
import { el, icon, toast, tempF } from "../lib/widgets.js";

let mapMounted = false;
let unsubscribe = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "flex flex-row w-full h-[calc(100vh-64px)] overflow-hidden" },
    // Map Area (70%)
    el("div", { class: "relative w-[70%] h-full flex-shrink-0" },
      el("div", { id: "map-heat", class: "absolute inset-0 w-full h-full" }),
      el("div", { class: "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background/60 to-transparent pointer-events-none" }),
      // Top Left: Title & Stats
      el("div", { class: "absolute top-[32px] left-[32px] bg-surface/80 backdrop-blur-md p-6 rounded-xl shadow-2xl flex flex-col gap-2 z-10 w-96" },
        el("div", { class: "flex justify-between items-start" },
          el("div", {},
            el("h1", { class: "font-headline text-[32px] leading-[40px] text-on-surface tracking-tight" }, place?.display || "Select Location"),
            el("p", { class: "font-data text-[14px] text-primary uppercase mt-1" }, place ? `${place.county} \u2022 Zone ${place.feature}` : "")
          ),
          el("span", { class: "bg-red-500/20 text-red-500 px-3 py-1 rounded-full font-data font-bold flex items-center gap-1" }, icon("warning", "text-[16px]"), "LVL 4")
        ),
        el("div", { class: "h-[1px] w-full bg-outline-variant/30 my-3" }),
        el("div", { class: "grid grid-cols-2 gap-4" },
          statBox("Peak Surface Temp", ctx?.heatmap?.stats?.max ? `${ctx.heatmap.stats.max.toFixed(1)}\u00b0C` : "\u2014"),
          statBox("Vulnerable Pop.", "\u2014")
        )
      ),
      // Floating Map Controls (Right)
      el("div", { class: "absolute top-[32px] right-[32px] flex flex-col gap-3 z-10" },
        controlGroup([
          { icon: "add", title: "Zoom In", action: () => map.zoomBy(1) },
          { icon: "remove", title: "Zoom Out", action: () => map.zoomBy(-1) }
        ]),
        controlGroup([
          { icon: "my_location", title: "My Location", action: () => map.locateMe() },
          { icon: "explore", title: "Reset View", action: () => map.resetView() }
        ]),
        controlGroup([
          { icon: "thermostat", title: "Thermal Layer", active: true, fill: true },
          { icon: "groups", title: "Vulnerability Layer" },
          { icon: "domain", title: "Infrastructure Layer" }
        ])
      ),
      // Heatmap Legend
      el("div", { class: "absolute bottom-[32px] left-[32px] bg-surface/80 backdrop-blur-md p-4 rounded-xl shadow-lg z-10 flex flex-col gap-2 w-72" },
        el("div", { class: "flex justify-between items-center mb-1" },
          el("span", { class: "font-data text-[10px] uppercase text-on-surface-variant" }, "Surface Temp Variance"),
          el("span", { class: "font-data text-[10px] text-on-surface-variant" }, "\u00b0F")
        ),
        el("div", { class: "w-full h-3 rounded-full bg-gradient-to-r from-blue-500 via-yellow-500 to-red-600" }),
        el("div", { class: "flex justify-between items-center font-data text-[10px] text-on-surface-variant mt-1" },
          el("span", {}, "Baseline (75)"),
          el("span", {}, "Elevated (90+)"),
          el("span", { class: "text-red-600 font-bold" }, "Critical (110+)")
        )
      )
    ),

    // Analysis Panel (30%)
    el("div", { class: "w-[30%] h-full bg-surface-container-lowest shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20 overflow-y-auto flex flex-col" },
      el("div", { class: "p-6 pb-4 shrink-0" },
        el("h2", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6 flex items-center gap-2" }, icon("analytics", "text-primary"), "Analysis Parameters"),
        el("div", { class: "space-y-5" },
          // Location Input
          el("div", { class: "flex flex-col gap-1" },
            el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, "Target Area"),
            el("div", { class: "relative w-full" }, icon("search", "absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"),
              el("input", { class: "w-full bg-surface-container-high border border-outline-variant/20 rounded-lg py-2 pl-9 pr-3 text-on-surface font-body focus:outline-none focus:border-amber-500 transition-colors", type: "text", value: place?.display || "Phoenix, AZ", placeholder: "Search location..." })
            )
          ),
          // Date/Time
          el("div", { class: "grid grid-cols-2 gap-4" },
            el("div", { class: "flex flex-col gap-1" },
              el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, "Date"),
              el("div", { class: "relative w-full" }, icon("calendar_month", "absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"),
                el("input", { class: "w-full bg-surface-container-high border border-outline-variant/20 rounded-lg py-2 pl-9 pr-3 text-on-surface font-data text-[12px] focus:outline-none focus:border-amber-500 transition-colors", type: "text", value: "2023-07-18" })
              )
            ),
            el("div", { class: "flex flex-col gap-1" },
              el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, "Time"),
              el("div", { class: "relative w-full" }, icon("schedule", "absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"),
                select(["14:00 (Peak)", "06:00 (Min)", "10:00 (Rising)", "18:00 (Cooling)"], "14:00 (Peak)")
              )
            )
          ),
          // Granularity & Layer
          el("div", { class: "grid grid-cols-2 gap-4" },
            el("div", { class: "flex flex-col gap-1" },
              el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, "Resolution"),
              select(["Block Group (30m)", "Tract (100m)", "ZIP Code"], "Block Group (30m)")
            ),
            el("div", { class: "flex flex-col gap-1" },
              el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, "Heat Metric"),
              select(["LST (Surface)", "Air Temp (2m)", "Heat Index"], "LST (Surface)")
            )
          ),
          el("button", { class: "w-full bg-amber-500 text-white hover:bg-amber-500/90 py-3 rounded-lg font-data text-[14px] font-bold uppercase tracking-wider transition-colors mt-2 shadow-lg shadow-amber-500/20", onclick: runAnalysis }, "Run Analysis")
        )
      ),
      el("div", { class: "w-full h-[1px] bg-outline-variant/10" }),
      el("div", { class: "p-6 flex-1 flex flex-col gap-6" },
        // KPI Row
        el("div", { class: "grid grid-cols-3 gap-3" },
          kpiCard("Avg Temp", ctx?.heatmap?.stats?.mean ? `${ctx.heatmap.stats.mean.toFixed(1)}\u00b0C` : "\u2014", "primary", sparkline([20, 15, 18, 8, 12, 5])),
          kpiCard("Max Temp", ctx?.heatmap?.stats?.max ? `${ctx.heatmap.stats.max.toFixed(1)}\u00b0C` : "\u2014", "error", sparkline([15, 12, 8, 18, 5, 2])),
          kpiCard("Exposure", ctx?.exposure?.level || "\u2014", "tertiary", sparkline([22, 20, 15, 10, 8, 5]))
        ),
        // Temp Distribution
        el("div", { class: "bg-surface rounded-xl p-4 flex flex-col gap-3" },
          el("div", { class: "flex justify-between items-center" },
            el("span", { class: "font-body font-semibold text-on-surface" }, "Temperature Distribution"),
            icon("bar_chart", "text-on-surface-variant text-[16px]")
          ),
          barChartDist()
        ),
        // Heat Trend
        el("div", { class: "bg-surface rounded-xl p-4 flex flex-col gap-3" },
          el("div", { class: "flex justify-between items-center" },
            el("span", { class: "font-body font-semibold text-on-surface" }, "Diurnal Heat Trend"),
            icon("show_chart", "text-on-surface-variant text-[16px]")
          ),
          lineChartTrend()
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-heat");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: place ? [place.lat, place.lon] : [33.4484, -112.074], zoom: 10 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid);
      }
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

function statBox(label, value) {
  return el("div", { class: "flex flex-col" },
    el("span", { class: "font-data text-[10px] uppercase text-on-surface-variant mb-1" }, label),
    el("span", { class: "font-headline text-[24px] leading-[32px] text-on-surface flex items-baseline" }, value)
  );
}

function controlGroup(buttons) {
  return el("div", { class: "bg-surface/80 backdrop-blur-md rounded-xl p-1 shadow-lg flex flex-col gap-1" },
    ...buttons.map(btn => el("button", {
      class: `w-10 h-10 rounded-lg flex items-center justify-center ${btn.active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"} transition-colors`,
      title: btn.title,
      onclick: btn.action,
      style: btn.fill ? "font-variation-settings: 'FILL' 1;" : ""
    }, icon(btn.icon, "text-[20px]")))
  );
}

function select(options, selected) {
  return el("select", { class: "w-full bg-surface-container-high border border-outline-variant/20 rounded-lg py-2 pl-9 pr-8 text-on-surface font-data text-[12px] appearance-none focus:outline-none focus:border-amber-500 transition-colors" },
    ...options.map(o => el("option", { selected: o === selected }, o))
  );
}

function kpiCard(label, value, color, sparkline) {
  const colorMap = { primary: "#c8c6c5", error: "#ffb4ab", tertiary: "#ffb59d" };
  return el("div", { class: "bg-surface p-3 rounded-lg flex flex-col gap-1 relative overflow-hidden" },
    el("div", { class: "absolute -right-4 -top-4 w-12 h-12 rounded-full blur-xl", style: `background: ${colorMap[color]}20` }),
    el("span", { class: "font-data text-[10px] uppercase text-on-surface-variant" }, label),
    el("span", { class: "font-data text-on-surface text-lg" }, value),
    el("div", { class: "h-6 w-full mt-2 opacity-50", style: `color: ${colorMap[color]}` }, sparkline)
  );
}

function sparkline(points) {
  const width = 100, height = 24;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("w-full", "h-full", "overflow-visible");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const max = Math.max(...points);
  const stepX = width / (points.length - 1);
  let d = "";
  points.forEach((p, i) => {
    const x = i * stepX;
    const y = height - (p / max) * (height - 4) - 2;
    d += `${i === 0 ? "M" : "L"}${x},${y} `;
  });
  path.setAttribute("d", d.trim());
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.appendChild(path);
  return svg;
}

function barChartDist() {
  return el("div", { class: "h-32 w-full flex items-end gap-1 px-2 pb-2 border-b border-l border-outline-variant/20 relative" },
    el("div", { class: "absolute -left-1 top-0 bottom-0 flex flex-col justify-between text-[8px] font-data text-on-surface-variant py-2 -translate-x-full pr-1" },
      el("span", {}, "40%"),
      el("span", {}, "20%"),
      el("span", {}, "0%")
    ),
    [10, 25, 45, 85, 60, 30, 15].map((h, i) => el("div", { class: "w-full transition-colors rounded-t-sm", style: `height: ${h}%; background: ${i < 2 ? "#c8c6c5" : i < 4 ? "#ffb59d" : "#ffb4ab"}` })),
    el("div", { class: "flex justify-between font-data text-[9px] text-on-surface-variant px-2" },
      el("span", {}, "80\u00b0"),
      el("span", {}, "90\u00b0"),
      el("span", {}, "100\u00b0"),
      el("span", {}, "110\u00b0"),
      el("span", {}, "120\u00b0")
    )
  );
}

function lineChartTrend() {
  return el("div", { class: "h-32 w-full relative pt-4 pb-6 border-b border-l border-outline-variant/20 ml-6" },
    el("svg", { class: "w-full h-full overflow-visible", viewBox: "0 0 200 100" },
      el("line", { class: "text-outline-variant/30", stroke: "currentColor", "stroke-dasharray": "2,2", "stroke-width": "0.5", x1: "0", x2: "200", y1: "25", y2: "25" }),
      el("line", { class: "text-outline-variant/30", stroke: "currentColor", "stroke-dasharray": "2,2", "stroke-width": "0.5", x1: "0", x2: "200", y1: "75", y2: "75" }),
      el("path", { class: "text-outline-variant/50", d: "M0,80 C40,80 60,60 100,50 C140,40 160,70 200,75", fill: "none", stroke: "currentColor", "stroke-width": "1.5" }),
      el("path", { class: "text-red-500", d: "M0,75 C40,70 80,10 120,5 C160,10 180,50 200,60", fill: "none", stroke: "currentColor", "stroke-width": "2" }),
      el("circle", { class: "text-red-500", cx: "120", cy: "5", fill: "currentColor", r: "4" }),
      el("circle", { class: "text-red-500 opacity-50 animate-ping", cx: "120", cy: "5", fill: "none", r: "8", stroke: "currentColor" })
    ),
    el("div", { class: "absolute -bottom-5 left-0 w-full flex justify-between font-data text-[9px] text-on-surface-variant" },
      el("span", {}, "00:00"),
      el("span", {}, "06:00"),
      el("span", { class: "text-red-500 font-bold" }, "14:00"),
      el("span", {}, "18:00"),
      el("span", {}, "23:59")
    ),
    el("div", { class: "flex items-center gap-4 mt-2" },
      el("div", { class: "flex items-center gap-1" }, el("div", { class: "w-3 h-[2px] bg-red-500" }), el("span", { class: "font-data text-[9px] text-on-surface-variant" }, "Today")),
      el("div", { class: "flex items-center gap-1" }, el("div", { class: "w-3 h-[2px] bg-outline-variant/50" }), el("span", { class: "font-data text-[9px] text-on-surface-variant" }, "Historical Avg"))
    )
  );
}

async function runAnalysis() {
  const st = getState();
  const placeId = st.place?.id;
  if (!placeId) return toast("No location selected", "error");
  
  toast("Running heat analysis...", "info");
  try {
    await Promise.all([
      loadContextFor(placeId),
      loadGridLayer(placeId, st.gridLayer)
    ]);
    toast("Analysis complete", "success");
  } catch (err) {
    toast(err.message || "Analysis failed", "error");
  }
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
}
