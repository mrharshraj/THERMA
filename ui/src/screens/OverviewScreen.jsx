// Command Overview Screen (from ui/command_overview/code.html)

import { getState, subscribe } from "../lib/store.js";
import { loadContextFor, loadGridLayer } from "../lib/api.js";
import { mount as mountMap, drawGrid, focusPlace, clearGrid } from "../lib/map.js";
import { el, icon, toast, tempF, bothTemps } from "../lib/widgets.js";

let mapMounted = false;
let unsubscribe = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;

  // Main content
  const main = el("main", { class: "flex-1 flex flex-col h-full overflow-hidden" },
    // Header
    el("div", { class: "flex justify-between items-end mb-6 px-[32px] pt-[32px]" },
      el("div", {},
        el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, "Command Overview"),
        el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant mt-1" }, "Global thermal intelligence dashboard"))
    ),

    // KPI Grid
    el("div", { class: "grid grid-cols-4 gap-[16px] mb-6 px-[32px]" },
      kpiCard("Current Heat Max", "thermostat", ctx?.heatmap?.stats?.max ? `${ctx.heatmap.stats.max.toFixed(1)}\u00b0C` : "\u2014", "error", ctx?.heatmap?.stats?.mean ? `+${(ctx.heatmap.stats.max - ctx.heatmap.stats.mean).toFixed(1)}\u00b0C vs avg` : null),
      kpiCard("Global Heat Risk", "warning", ctx?.exposure?.level || "\u2014", ctx?.exposure?.level === "Critical" ? "error" : ctx?.exposure?.level === "High" ? "tertiary" : "primary", ctx?.exposure?.score ? `${ctx.exposure.score}/100` : null),
      kpiCard("Active Alerts", "notifications_active", ctx?.alerts?.length || 0, "tertiary", ctx?.alerts?.filter(a => a.severity === "Critical").length ? `${ctx.alerts.filter(a => a.severity === "Critical").length} Critical` : null),
      kpiCard("Assets at Risk", "domain", ctx?.assets?.filter(a => a.risk && a.risk.index >= 3).length || 0, "primary", null)
    ),

    // Main Map + Sidebar
    el("div", { class: "grid grid-cols-12 gap-[16px] h-[600px] flex-1 px-[32px] pb-[32px]" },
      // Map Area (8 cols)
      el("div", { class: "col-span-8 bg-surface-container rounded-xl shadow-md overflow-hidden relative flex flex-col" },
        el("div", { class: "absolute top-4 left-4 z-10 flex gap-2" },
          el("button", { class: "bg-surface/90 backdrop-blur px-4 py-2 rounded-lg font-data text-[12px] text-on-surface flex items-center gap-2 shadow-lg hover:bg-surface transition-colors" }, icon("layers", "text-[16px]"), "Heatmap"),
          el("button", { class: "bg-surface/90 backdrop-blur px-4 py-2 rounded-lg font-data text-[12px] text-outline flex items-center gap-2 shadow-lg hover:bg-surface transition-colors" }, icon("domain", "text-[16px]"), "Assets")
        ),
        el("div", { class: "absolute top-4 right-4 z-10 bg-surface/90 backdrop-blur p-3 rounded-lg shadow-lg flex flex-col gap-2" },
          el("button", { class: "w-8 h-8 flex items-center justify-center text-on-surface hover:text-primary transition-colors", title: "Zoom In" }, icon("add")),
          el("button", { class: "w-8 h-8 flex items-center justify-center text-on-surface hover:text-primary transition-colors", title: "Zoom Out" }, icon("remove")),
          el("div", { class: "w-full h-[1px] bg-outline-variant/30 my-1" }),
          el("button", { class: "w-8 h-8 flex items-center justify-center text-on-surface hover:text-primary transition-colors", title: "My Location" }, icon("my_location"))
        ),
        el("div", { class: "absolute bottom-4 left-4 z-10 bg-surface/90 backdrop-blur p-4 rounded-lg shadow-lg" },
          el("div", { class: "font-data text-[10px] text-outline uppercase mb-2" }, "Thermal Intensity (\u00b0C)"),
          el("div", { class: "flex items-center gap-2" },
            el("span", { class: "font-data text-[10px] text-on-surface" }, "25"),
            el("div", { class: "w-32 h-2 rounded-full bg-gradient-to-r from-blue-500 via-yellow-500 to-red-600" }),
            el("span", { class: "font-data text-[10px] text-on-surface" }, "45+")
          )
        ),
        el("div", { id: "map-overview", class: "w-full h-full" })
      ),

      // Right Sidebar (4 cols)
      el("div", { class: "col-span-4 flex flex-col gap-[16px] h-full" },
        el("div", { class: "bg-surface-container rounded-xl shadow-md p-6 flex flex-col h-[60%]" },
          el("div", { class: "flex justify-between items-center mb-6 shrink-0" },
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "Active Alerts"),
            el("button", { class: "font-data text-[12px] text-primary hover:text-on-surface transition-colors" }, "View All")
          ),
          el("div", { class: "flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar", id: "alerts-list" },
            ...(ctx?.alerts || []).slice(0, 3).map(a => alertCard(a))
          )
        ),
        el("div", { class: "bg-surface-container rounded-xl shadow-md p-6 flex flex-col h-[40%]" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6" }, "Heat Trend (24h)"),
          el("div", { class: "flex-1 w-full relative" },
            el("svg", { class: "w-full h-full overflow-visible", preserveAspectRatio: "none", viewBox: "0 0 400 100" },
              el("path", { class: "text-red-500 opacity-50", d: "M0,80 L40,75 L80,60 L120,40 L160,20 L200,10 L240,25 L280,45 L320,65 L360,70 L400,85", fill: "none", stroke: "currentColor", "stroke-width": "2" }),
              el("path", { class: "text-primary", d: "M0,90 L40,85 L80,80 L120,70 L160,50 L200,30 L240,45 L280,65 L320,75 L360,80 L400,95", fill: "none", stroke: "currentColor", "stroke-width": "2" })
            ),
            el("div", { class: "absolute bottom-0 w-full flex justify-between font-data text-[10px] text-outline mt-2" },
              el("span", {}, "-24h"),
              el("span", {}, "-12h"),
              el("span", {}, "Now")
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Mount map after DOM insertion
  setTimeout(() => {
    const mapContainer = document.getElementById("map-overview");
    if (mapContainer && !mapMounted) {
      mountMap(mapContainer, { center: ctx?.location ? [ctx.location.lat, ctx.location.lon] : DEFAULT_CENTER, zoom: 4 });
      mapMounted = true;
      
      // Draw heat grid if available
      if (ctx?.heatmap?.grid) {
        drawGrid(ctx.heatmap.grid);
      }
    }
  }, 100);

  // Subscribe to context changes
  unsubscribe = subscribe((state) => {
    if (state.context && state.context.heatmap) {
      const grid = state.context.heatmap.grid;
      if (grid) drawGrid(grid);
    }
  });
}

function kpiCard(title, iconName, value, color, sub) {
  const colors = {
    error: { bg: "bg-red-500/10", icon: "text-red-500", text: "text-red-500", trend: "text-red-500" },
    tertiary: { bg: "bg-amber-500/10", icon: "text-amber-500", text: "text-amber-500", trend: "text-amber-500" },
    primary: { bg: "bg-gray-400/10", icon: "text-gray-400", text: "text-gray-400", trend: "text-gray-400" }
  };
  const c = colors[color] || colors.primary;
  
  return el("div", { class: `${c.bg} rounded-xl p-6 shadow-md relative overflow-hidden group` },
    el("div", { class: "absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl group-hover:opacity-20 transition-opacity", style: `background: ${color === "error" ? "rgba(239,68,68,0.1)" : color === "tertiary" ? "rgba(245,158,11,0.1)" : "rgba(136,145,146,0.1)"}` }),
    el("div", { class: "flex justify-between items-start mb-4" },
      el("span", { class: "font-data text-[10px] uppercase text-outline" }, title),
      el("span", { class: `material-symbols-outlined ${c.icon}` }, iconName)
    ),
    el("div", { class: "flex items-baseline gap-2" },
      el("span", { class: "font-display text-[48px] leading-[56px] text-on-surface" }, value)
    ),
    sub ? el("div", { class: `mt-4 flex items-center gap-2 ${c.trend}` },
      el("span", { class: "material-symbols-outlined text-[16px]" }, "trending_up"),
      el("span", { class: "font-data text-[12px]" }, sub)
    ) : null
  );
}

function alertCard(a) {
  const sevColors = {
    Critical: { bg: "bg-red-500/10", border: "border-red-500", icon: "text-red-500", text: "text-red-500" },
    High: { bg: "bg-amber-500/10", border: "border-amber-500", icon: "text-amber-500", text: "text-amber-500" },
    Warning: { bg: "bg-amber-500/10", border: "border-amber-500", icon: "text-amber-500", text: "text-amber-500" }
  };
  const c = sevColors[a.severity] || sevColors.Critical;
  
  return el("div", { class: `${c.bg} p-4 rounded-lg ${c.border} hover:bg-surface-container-highest transition-colors cursor-pointer group` },
    el("div", { class: "flex justify-between items-start mb-2" },
      el("span", { class: `${c.icon} uppercase flex items-center gap-1 font-data text-[10px]` }, icon("warning", "text-[14px]"), a.severity),
      el("span", { class: "font-data text-[10px] text-outline" }, a.time || "Just now")
    ),
    el("h4", { class: "font-body text-[14px] text-on-surface font-semibold mb-1" }, a.location),
    el("div", { class: "flex items-center gap-4" },
      el("span", { class: "font-data text-[14px] text-red-500" }, a.temp ? `${a.temp}\u00b0C` : ""),
      el("span", { class: "font-data text-[12px] text-outline flex items-center gap-1" }, icon(a.icon || "thermostat", "text-[14px]"), a.description)
    )
  );
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
}
