// Facility Analysis Screen (from ui/facility_analysis/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer, loadEnvironmentFor } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, clearGrid, addMarker, clearMarkers } from "../lib/map.js";
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

  const main = el("main", { class: "flex flex-col h-full" },
    // Floating Background Ambient Light
    el("div", { class: "absolute top-0 right-0 w-2/3 h-1/2 bg-error/10 blur-[120px] rounded-full pointer-events-none transform -translate-y-1/4 translate-x-1/4" }),

    // Command Center Header
    el("header", { class: "px-[32px] pt-12 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10" },
      el("div", { class: "space-y-4 max-w-2xl" },
        el("div", { class: "inline-flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full" },
          el("span", { class: "w-2 h-2 rounded-full bg-error animate-pulse" }),
          el("span", { class: "font-data text-[10px] uppercase tracking-widest text-on-surface-variant" }, `Active Threat Level: ${ctx?.exposure?.level || "High"}`)
        ),
        el("div", {},
          el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, place?.display || "Site Alpha-Omega"),
          el("p", { class: "font-headline text-[24px] leading-[32px] text-on-surface-variant mt-2" }, "Facility Thermal Signature Analysis")
        ),
        el("div", { class: "flex flex-wrap items-center gap-4 text-on-surface-variant" },
          el("span", { class: "font-data text-[12px] bg-surface-container px-2 py-1 rounded" }, `COORD: ${place?.lat?.toFixed(4)}° N, ${Math.abs(place?.lon || 0).toFixed(4)}° ${place?.lon < 0 ? "W" : "E"}`),
          el("span", { class: "font-data text-[12px] bg-surface-container px-2 py-1 rounded" }, "ZONE: Industrial Sector 4"),
          el("span", { class: "font-data text-[12px] bg-surface-container px-2 py-1 rounded" }, `STATUS: ${ctx?.exposure?.level === "Critical" ? "Critical" : "High"} Operations Alert`)
        )
      ),
      el("div", { class: "flex gap-4" },
        el("button", { class: "px-6 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded font-data text-[12px] uppercase tracking-widest transition-colors flex items-center gap-2 group", onclick: () => navigate("reports") }, icon("history", "text-[18px] group-hover:text-primary transition-colors"), "Historical Data"),
        el("button", { class: "px-6 py-3 bg-error text-on-error rounded font-data text-[12px] uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-error/20", onclick: () => toast("Deploying emergency protocol...", "info") }, icon("warning", "text-[18px]"), "Deploy Protocol")
      )
    ),

    // Main Grid Layout
    el("div", { class: "px-[32px] pb-[32px] grid grid-cols-12 gap-[16px] relative z-10 flex-1" },
      // Left Column: Metrics & Critical Assets (4 cols)
      el("div", { class: "col-span-12 lg:col-span-4 flex flex-col gap-[16px]" },
        // Key Metrics Bento
        el("section", { class: "grid grid-cols-2 gap-4" },
          metricCard("Ambient Core", "thermostat", "primary", env?.temperatureC ? `${env.temperatureC.toFixed(1)}\u00b0` : "42.8\u00b0", env?.temperatureC ? `? +${(env.temperatureC - (env.temperatureC - 2.4)).toFixed(1)}\u00b0 vs 24h avg` : "? +2.4\u00b0 vs 24h avg", "primary"),
          metricCard("Thermal Load", "brightness_high", "error", "89%", "Critical Threshold", "error"),
          metricCard("Operational Risk Index", "warning", "error", "85/100", "SEVERE", "error", true, "col-span-2")
        ),

        // Critical Assets List
        el("section", { class: "bg-surface-container rounded-lg p-6 flex-1 flex flex-col" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6 flex items-center gap-2" }, icon("precision_manufacturing", "text-primary"), "Vulnerable Assets"),
          el("div", { class: "space-y-4 flex-1", id: "assets-list" },
            ...assets.filter(a => a.risk && a.risk.index >= 3).slice(0, 5).map((asset, i) => assetRow(asset, i))
          )
        )
      ),

      // Center/Right Column: Main Map & Interventions (8 cols)
      el("div", { class: "col-span-12 lg:col-span-8 flex flex-col gap-[16px]" },
        // Facility Thermal Map
        el("section", { class: "bg-surface-container rounded-lg p-2 flex-1 relative min-h-[500px] overflow-hidden group" },
          el("div", { class: "absolute top-6 left-6 z-10 flex gap-2" },
            mapLegend("Hotspots", "error"),
            mapLegend("Sensors", "primary")
          ),
          el("div", { class: "absolute top-6 right-6 z-10 flex flex-col gap-2" },
            mapControlBtn("zoom_in", () => map?.zoomBy(1)),
            mapControlBtn("zoom_out", () => map?.zoomBy(-1)),
            mapControlBtn("layers", () => {})
          ),
          // The Map
          el("div", { id: "map-facility", class: "w-full h-full rounded-md relative" },
            // Simulated Map Overlays (Hotspots) - will be replaced by Leaflet
            el("div", { class: "absolute top-1/4 left-1/3 w-32 h-32 bg-error/40 blur-3xl rounded-full mix-blend-screen pointer-events-none" }),
            el("div", { class: "absolute bottom-1/3 right-1/4 w-48 h-48 bg-tertiary/30 blur-3xl rounded-full mix-blend-screen pointer-events-none" }),
            // Sensor Nodes
            el("div", { class: "absolute top-1/4 left-1/3 w-4 h-4 bg-error rounded-full ring-4 ring-error/20 flex items-center justify-center animate-pulse cursor-pointer", onclick: () => toast("HVAC Alpha: 54.2°C", "info") },
              el("div", { class: "w-1 h-1 bg-on-error rounded-full" })
            ),
            el("div", { class: "absolute bottom-1/3 right-1/4 w-3 h-3 bg-tertiary rounded-full ring-4 ring-tertiary/20 flex items-center justify-center cursor-pointer", onclick: () => toast("Main Server Rack: 31.8°C", "info") })
          )
        ),

        // Bottom Row: Interventions & Recommendations
        el("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-[16px] h-64" },
          // Cooling Opportunities
          el("section", { class: "bg-surface-container rounded-lg p-6 relative overflow-hidden" },
            el("h4", { class: "font-data text-[10px] uppercase tracking-widest text-outline mb-4" }, "Cooling Opportunities"),
            el("div", { class: "space-y-4 relative z-10" },
              interventionRow("roofing", "Reflective Roof Coating", "Est. Impact: -4.2\u00b0C ambient", "primary"),
              el("div", { class: "w-full h-px bg-outline-variant/20" }),
              interventionRow("air", "HVAC Shade Structures", "Est. Impact: +15% efficiency", "primary")
            ),
            el("div", { class: "absolute -bottom-8 -right-8 opacity-5 pointer-events-none" }, icon("ac_unit", "text-[120px]"))
          ),

          // Recommended Action
          el("section", { class: "bg-gradient-to-br from-surface-container-high to-surface-container rounded-lg p-6 shadow-xl shadow-background/50 relative flex flex-col justify-between" },
            el("div", { class: "absolute top-0 left-0 w-full h-1 bg-error" }),
            el("div", {},
              el("div", { class: "flex items-center gap-2 mb-3" }, icon("priority_high", "text-error"), el("h4", { class: "font-data text-[10px] uppercase tracking-widest text-error" }, "Priority Recommendation")),
              el("h3", { class: "font-headline text-[20px] text-on-surface leading-tight mb-2" }, "Evacuate Roof Sector B & Deploy Portable Chillers"),
              el("p", { class: "font-body text-[14px] text-on-surface-variant line-clamp-2" }, "HVAC Alpha is exceeding operational thermal limits. Immediate localized cooling required to prevent catastrophic failure and potential localized fire risk.")
            ),
            el("div", { class: "flex justify-between items-center mt-4" },
              el("span", { class: "font-data text-[10px] text-outline" }, "AUTHORIZATION REQ."),
              el("button", { class: "px-4 py-2 bg-on-surface text-surface hover:bg-primary hover:text-on-primary transition-colors rounded font-data text-[12px] uppercase font-bold flex items-center gap-2", onclick: () => toast("Executing emergency protocol...", "info") }, "Execute Order", icon("chevron_right", "text-[16px]"))
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-facility");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: place ? [place.lat, place.lon] : [34.0522, -118.2437], zoom: 15 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid);
        
        // Add facility markers
        const facilityAssets = assets.filter(a => ["energy", "healthcare", "communications"].includes(a.category));
        facilityAssets.forEach(a => addMarker({ lat: a.lat, lon: a.lon, label: a.name, category: a.category, color: a.risk?.index >= 4 ? "#ffb4ab" : a.risk?.index === 3 ? "#ffb59d" : "#c8c6c5" }));
      }
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      loadGridLayer(state.place?.id, state.gridLayer).catch(() => {});
    }
  });
}

function metricCard(label, iconName, iconColor, value, sub, trendColor, fullWidth = false, span = "") {
  const colorMap = { primary: "bg-primary", error: "bg-error", tertiary: "bg-tertiary", secondary: "bg-secondary" };
  const cardClass = `bg-surface-container p-5 rounded-lg flex flex-col justify-between aspect-square group hover:bg-surface-container-high transition-colors relative overflow-hidden ${fullWidth ? "col-span-2" : ""}`;
  return el("div", { class: cardClass },
    el("div", { class: `absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 transition-colors ${colorMap[iconColor]}/5` }),
    el("div", { class: "flex justify-between items-start" },
      el("span", { class: "font-data text-[10px] uppercase text-outline tracking-widest" }, label),
      icon(iconName, `text-${iconColor} text-[20px]`)
    ),
    el("div", {},
      fullWidth ? (
        <>
          <div class="font-display text-[40px] text-on-surface">{value}</div>
          <div class="font-body text-on-surface-variant flex items-center gap-1 mt-1 text-[14px]">{sub}</div>
        </>
      ) : (
        <>
          <div class="font-display text-[40px] text-on-surface">{value}</div>
          <div class="font-body text-on-surface-variant flex items-center gap-1 mt-1 text-[14px]">{sub}</div>
        </>
      )
    ),
    fullWidth ? el("div", { class: "w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-2" },
      el("div", { class: "h-full bg-error rounded-full", style: "width: 85%" })
    ) : null,
    fullWidth ? el("div", { class: "flex justify-between font-data text-[10px] text-on-surface-variant" },
      el("span", {}, "Nominal"),
      el("span", {}, "Critical (85)")
    ) : null
  );
}

function assetRow(asset, index) {
  const risk = asset.risk;
  const riskColors = {
    Critical: { bar: "bg-error", badge: "bg-error/10 text-error", status: "FAILING" },
    High: { bar: "bg-tertiary", badge: "bg-tertiary/10 text-tertiary", status: "ELEVATED" },
    Elevated: { bar: "bg-tertiary", badge: "bg-tertiary/10 text-tertiary", status: "ELEVATED" },
    Moderate: { bar: "bg-amber-500", badge: "bg-amber-500/10 text-amber-500", status: "WATCH" },
    Low: { bar: "bg-outline", badge: "bg-surface-container-highest px-2 py-0.5 rounded", status: "MONITORING" }
  };
  const rc = riskColors[risk?.band] || riskColors.Low;

  return el("div", { class: "group relative bg-surface-container-low hover:bg-surface-container-high p-4 rounded transition-colors cursor-pointer" },
    el("div", { class: `absolute left-0 top-0 bottom-0 w-1 rounded-l opacity-0 group-hover:opacity-100 transition-opacity ${rc.bar}` }),
    el("div", { class: "flex justify-between items-start mb-2" },
      el("div", { class: "font-data text-[12px] text-on-surface font-bold" }, asset.name),
      el("span", { class: `font-data text-[10px] ${rc.badge} px-2 py-0.5 rounded` }, rc.status)
    ),
    el("div", { class: "flex justify-between text-[12px] text-on-surface-variant" },
      el("span", {}, `Sector ${asset.id.split("-").pop() || "Unknown"}`),
      el("span", { class: "font-data text-on-surface" }, asset.tempC ? `${asset.tempC.toFixed(1)}\u00b0C` : "—")
    )
  );
}

function mapLegend(label, color) {
  return el("div", { class: "bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded font-data text-[10px] text-on-surface flex items-center gap-2 shadow-lg" }, el("span", { class: `w-2 h-2 rounded-full ${color === "error" ? "bg-error" : "bg-primary"}` }), label);
}

function mapControlBtn(iconName, action) {
  return el("button", { class: "w-10 h-10 bg-surface/80 backdrop-blur-md rounded flex items-center justify-center text-on-surface hover:bg-surface transition-colors shadow-lg", onclick: action }, icon(iconName));
}

function interventionRow(iconName, label, impact, color) {
  return el("div", { class: "flex justify-between items-center group cursor-pointer" },
    el("div", { class: "flex items-center gap-3" },
      el("div", { class: `w-8 h-8 rounded bg-${color}/10 flex items-center justify-center text-${color} group-hover:bg-${color} group-hover:text-on-primary transition-colors` }, icon(iconName, "text-[16px]")),
      el("div", {},
        el("div", { class: "font-body text-on-surface text-[14px]" }, label),
        el("div", { class: "font-data text-[10px] text-on-surface-variant" }, impact)
      )
    ),
    icon("arrow_forward", "text-outline group-hover:text-primary transition-colors")
  );
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
  clearMarkers();
}
