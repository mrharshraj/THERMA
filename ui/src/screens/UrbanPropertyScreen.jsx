// Urban & Property Intelligence Screen (from ui/urban_property_intelligence/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer } from "../lib/api.js";
import { mount as mountMap, drawGrid, clearGrid, drawAoiBounds, focusPlace, addMarker, clearMarkers } from "../lib/map.js";
import { el, icon, toast, tempF, severityChip } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;
let selectedParcel = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "relative w-full h-[calc(100vh-64px)] flex gap-[16px] p-[16px]" },
    // Map Background Layer (Full bleed)
    el("div", { class: "absolute inset-0 z-0 flex-1" },
      el("div", { id: "map-urban", class: "absolute inset-0 z-0" }),
      el("div", { class: "absolute inset-0 bg-gradient-to-tr from-error/30 via-tertiary/10 to-transparent mix-blend-multiply pointer-events-none" }),
      el("div", { class: "absolute inset-0 bg-surface/20 backdrop-blur-[2px] pointer-events-none" })
    ),

    // Floating Interface Layer
    el("div", { class: "relative z-10 w-full h-full p-[16px] flex gap-[16px]" },
      // Left Contextual Panel
      el("div", { class: "w-96 flex-shrink-0 flex flex-col gap-[16px] h-full" },
        // Metrics Overview Card
        el("div", { class: "bg-surface/80 backdrop-blur-xl rounded-xl p-6 shadow-xl flex flex-col gap-4" },
          el("div", { class: "flex items-center justify-between mb-2" },
            el("div", {},
              el("div", { class: "text-[10px] font-data-mono text-outline uppercase font-bold tracking-widest" }, "Zone Analysis"),
              el("h2", { class: "font-headline text-[24px] leading-[32px] text-on-surface", id: "zone-name" }, place?.display || "Select Location")
            ),
            icon("analytics", "text-outline-variant")
          ),
          el("div", { class: "grid grid-cols-2 gap-4" },
            metricBox("Heat Risk", ctx?.exposure?.score || 87, "/100", "error", 87),
            metricBox("Canopy Cover", "12", "%", "primary", 12),
            metricBox("Surface Exp.", "High", "", "tertiary", 0),
            metricBox("Bldg Density", "8.4", "FAR", "primary", 0)
          )
        ),
        // Property Details Panel
        el("div", { class: "bg-surface/80 backdrop-blur-xl rounded-xl p-6 shadow-xl flex-1 overflow-y-auto flex flex-col gap-6 custom-scrollbar", id: "property-panel" },
          el("div", { class: "flex justify-between items-start" },
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "Selected Parcel"),
            el("div", { class: "bg-surface-container-high px-2 py-1 rounded text-[10px] font-data-mono text-on-surface-variant", id: "parcel-id" }, "ID: \u2014")
          ),
          // Radar Chart Placeholder
          el("div", { class: "w-full aspect-square relative flex items-center justify-center bg-surface-container-lowest rounded-xl p-4" },
            el("svg", { class: "w-full h-full text-outline-variant/30 overflow-visible", viewBox: "0 0 100 100", id: "radar-chart" }),
            // Labels
            el("span", { class: "absolute top-2 text-[8px] font-data-mono text-outline uppercase" }, "Albedo"),
            el("span", { class: "absolute top-1/4 right-2 text-[8px] font-data-mono text-outline uppercase" }, "Thermal Mass"),
            el("span", { class: "absolute bottom-1/4 right-2 text-[8px] font-data-mono text-outline uppercase" }, "HVAC Load"),
            el("span", { class: "absolute bottom-2 text-[8px] font-data-mono text-outline uppercase" }, "Shading"),
            el("span", { class: "absolute bottom-1/4 left-2 text-[8px] font-data-mono text-outline uppercase" }, "Green Roof"),
            el("span", { class: "absolute top-1/4 left-2 text-[8px] font-data-mono text-outline uppercase" }, "Permeability")
          ),
          el("div", { class: "space-y-4" },
            el("h4", { class: "text-[10px] font-data-mono text-outline uppercase tracking-widest font-bold" }, "Mitigation Potential"),
            mitigationRow("roofing", "Cool Roof Conv.", "-4.2\u00b0C"),
            mitigationRow("park", "Canopy Expansion", "-1.8\u00b0C")
          ),
          el("button", { class: "w-full bg-primary text-on-primary font-headline text-headline py-3 rounded-lg hover:bg-primary-fixed transition-colors mt-auto", onclick: () => toast("Generating report...", "info") }, "Generate Report")
        )
      ),

      // Right Side Map Controls & Comparison
      el("div", { class: "flex-1 flex flex-col justify-between items-end h-full" },
        // Map Tooling
        el("div", { class: "bg-surface/80 backdrop-blur-xl rounded-full p-2 flex flex-col gap-2 shadow-lg" },
          mapToolBtn("layers", false),
          mapToolBtn("thermostat", true),
          mapToolBtn("forest", false),
          el("div", { class: "w-6 h-[1px] bg-outline-variant/30 mx-auto my-1" }),
          mapToolBtn("add", false),
          mapToolBtn("remove", false)
        ),
        // Comparison Widget Bottom Right
        el("div", { class: "w-[500px] bg-surface/90 backdrop-blur-xl rounded-xl shadow-2xl p-6 mb-4 mr-4 border border-outline-variant/10" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4" }, "Location Comparison"),
          el("div", { class: "grid grid-cols-[auto_1fr_1fr] gap-y-4 gap-x-6 items-center" },
            el("div", {}),
            el("div", { class: "font-data text-[10px] text-outline uppercase tracking-wider" }, place?.display || "Downtown Metro (Current)"),
            el("div", { class: "font-data text-[10px] text-outline uppercase tracking-wider" }, "Suburban Ring (Ref)"),
            comparisonRow("Avg Surface Temp", "42.5\u00b0C", "36.1\u00b0C", "error", "on-surface"),
            comparisonRow("Impervious Surface", "88%", "45%", "error", "on-surface"),
            comparisonRow("Cooling Opp.", "High", "Low", "primary", "on-surface-variant")
          ),
          el("div", { class: "mt-6 p-4 bg-surface-container-lowest rounded-lg border border-outline-variant/10" },
            el("p", { class: "font-body text-body text-on-surface-variant italic" },
              el("span", { class: "material-symbols-outlined text-[16px] inline-block align-text-bottom mr-1 text-tertiary" }, "lightbulb"),
              "Deploying cool roofs and increasing canopy by 15% in Downtown Metro could normalize surface temperatures to reference levels within 5 years."
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-urban");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: place ? [place.lat, place.lon] : [34.0522, -118.2437], zoom: 10 });
      mapMounted = true;
      if (place) {
        drawAoiBounds(place.bbox);
        if (ctx?.heatmap?.grid) drawGrid(ctx.heatmap.grid, { onClick: handleParcelClick });
      }
      renderRadarChart();
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      loadGridLayer(state.place?.id, state.gridLayer).catch(() => {});
    }
  });
}

function metricBox(label, value, unit, color, progress) {
  const colorMap = { error: "bg-error", primary: "bg-primary", tertiary: "bg-tertiary", secondary: "bg-secondary" };
  return el("div", { class: "flex flex-col gap-1" },
    el("span", { class: "text-[10px] font-data-mono text-outline uppercase tracking-wider" }, label),
    el("div", { class: "flex items-end gap-2" },
      el("span", { class: `font-headline text-[32px] leading-[40px] text-${color}` }, value),
      el("span", { class: "text-body text-on-surface-variant font-body mb-1" }, unit)
    ),
    el("div", { class: "h-1 w-full bg-surface-container-high rounded-full overflow-hidden mt-1" },
      el("div", { class: "h-full transition-all duration-1000", style: `background: ${colorMap[color]}; width: ${progress}%` })
    )
  );
}

function mitigationRow(iconName, label, impact) {
  return el("div", { class: "flex items-center justify-between p-3 bg-surface-container rounded-lg" },
    el("div", { class: "flex items-center gap-3" },
      icon(iconName, "text-primary"),
      el("span", { class: "font-body text-body text-on-surface" }, label)
    ),
    el("span", { class: "font-data text-data-mono text-primary" }, impact)
  );
}

function comparisonRow(label, current, ref, currentColor, refColor) {
  return el("div", { class: "contents" },
    el("div", { class: "font-body text-body text-on-surface-variant" }, label),
    el("div", { class: `font-data text-data-mono text-${currentColor}` }, current),
    el("div", { class: `font-data text-data-mono text-${refColor}` }, ref)
  );
}

function mapToolBtn(iconName, active) {
  return el("button", { class: `w-10 h-10 rounded-full flex items-center justify-center ${active ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"} transition-colors` }, icon(iconName));
}

function handleParcelClick(tile) {
  if (!tile) return;
  selectedParcel = tile;
  
  const panel = document.getElementById("property-panel");
  if (panel) {
    panel.querySelector("#parcel-id").textContent = `ID: ${tile.id}-X`;
    panel.querySelector("#zone-name").textContent = `Tile ${tile.id}`;
  }
  
  toast(`Parcel ${tile.id} selected`, "info");
  renderRadarChart(tile);
}

function renderRadarChart(tile) {
  const svg = document.getElementById("radar-chart");
  if (!svg) return;
  
  // Generate values based on tile data or defaults
  const values = tile ? [
    Math.min(100, Math.round((tile.value || 30) * 2)), // Albedo (inverted)
    Math.min(100, Math.round((tile.value || 30) * 1.5)), // Thermal Mass
    Math.min(100, Math.round((tile.value || 30) * 1.8)), // HVAC Load
    Math.min(100, 100 - Math.round((tile.value || 30) * 1.2)), // Shading (inverted)
    Math.min(100, 100 - Math.round((tile.value || 30) * 1.5)), // Green Roof (inverted)
    Math.min(100, 100 - Math.round((tile.value || 30) * 2)) // Permeability (inverted)
  ] : [40, 60, 75, 30, 25, 20];
  
  // Clear and rebuild radar
  svg.innerHTML = `
    <polygon fill="none" points="50,5 95,27 95,72 50,95 5,72 5,27" stroke="currentColor" stroke-width="0.5"></polygon>
    <polygon fill="none" points="50,20 80,35 80,65 50,80 20,65 20,35" stroke="currentColor" stroke-width="0.5"></polygon>
    <polygon fill="none" points="50,35 65,42 65,57 50,65 35,57 35,42" stroke="currentColor" stroke-width="0.5"></polygon>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="50" y1="50" y2="5"></line>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="95" y1="50" y2="27"></line>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="95" y1="50" y2="72"></line>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="50" y1="50" y2="95"></line>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="5" y1="50" y2="72"></line>
    <line stroke="currentColor" stroke-width="0.5" x1="50" x2="5" y1="50" y2="27"></line>
    <polygon class="text-error/20" fill="currentColor" points="${radarPoints(values)}" stroke="currentColor" stroke-width="1.5" style="color: var(--color-error)"></polygon>
  `;
}

function radarPoints(values) {
  // 6 axes at 60 degree intervals
  const cx = 50, cy = 50;
  const maxR = 45;
  return values.map((v, i) => {
    const angle = (i * 60 - 90) * Math.PI / 180;
    const r = (v / 100) * maxR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
  clearMarkers();
}
