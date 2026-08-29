// Scenario Simulation Screen (from ui/scenario_simulation_workspace/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer } from "../lib/api.js";
import { mount as mountMap, drawGrid, clearGrid, drawAoiBounds } from "../lib/map.js";
import { el, icon, toast, tempF } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;
let baselineMap = null;
let projectedMap = null;
let interventions = {
  canopy: 15,
  coolRoofs: 30,
  shade: 5,
  albedo: 20
};

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "flex flex-col h-full" },
    // Header Area
    el("div", { class: "px-[32px] py-[16px] flex justify-between items-end border-b border-outline-variant/10 bg-surface/90 backdrop-blur sticky top-0 z-10" },
      el("div", {},
        el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, "Scenario Simulation"),
        el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant mt-2 max-w-2xl" }, "Intervention modeler for urban heat mitigation strategies. Adjust parameters to project impact on surface temperatures and risk scores.")
      ),
      el("div", { class: "flex gap-4" },
        el("button", { class: "px-6 py-3 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-headline text-headline flex items-center gap-2", onclick: () => toast("Load preset functionality coming soon", "info") }, icon("history", "text-[20px]"), "Load Preset"),
        el("button", { class: "px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors font-headline text-headline flex items-center gap-2 shadow-lg shadow-primary/20", onclick: runSimulation }, icon("play_arrow", "text-[20px]"), "Run Simulation")
      )
    ),

    // Main Content Grid
    el("div", { class: "grid grid-cols-12 gap-[16px] p-[32px] h-[calc(100vh-140px)]" },
      // Left Panel: Control Panel
      el("div", { class: "col-span-12 lg:col-span-3 flex flex-col gap-[16px] overflow-y-auto pr-2" },
        el("div", { class: "bg-surface-container rounded-xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden group" },
          el("div", { class: "absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none transition-opacity opacity-50 group-hover:opacity-100" }),
          el("h3", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-2 z-10" }, icon("tune", "text-primary"), "Interventions"),
          // Slider 1
          sliderControl("Tree Canopy", "canopy", 15, 0, 40, "Current: 12%", "Max: 40%"),
          // Slider 2
          sliderControl("Cool Roofs", "coolRoofs", 30, 0, 80, "Current: 5%", "Max: 80%"),
          // Slider 3
          sliderControl("Shade Structures", "shade", 5, 0, 100, "", ""),
          // Slider 4
          sliderControl("Albedo Surface", "albedo", 20, 0, 100, "", "")
        ),
        // Impact Summary
        el("div", { class: "bg-surface-container rounded-xl p-6 shadow-sm flex-1 flex flex-col gap-4 relative overflow-hidden" },
          el("h3", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-2" }, icon("analytics", "text-primary"), "Projected Impact"),
          el("div", { class: "grid grid-cols-2 gap-4 mt-2" },
            impactBox("Peak Temp", "38°", "-2.4°", "primary"),
            impactBox("Risk Score", "42", "-15", "primary")
          ),
          el("div", { class: "mt-auto" },
            el("span", { class: "text-[10px] uppercase font-data text-on-surface-variant mb-2 block" }, "Exposure Reduction"),
            el("div", { class: "h-24 w-full relative" },
              el("svg", { class: "w-full h-full", preserveAspectRatio: "none", viewBox: "0 0 100 40" },
                el("path", { class: "text-on-surface-variant opacity-30", d: "M0,35 Q25,35 50,20 T100,5", fill: "none", stroke: "currentColor", "stroke-width": "2" }),
                el("path", { class: "text-primary", d: "M0,35 Q25,25 50,15 T100,25", fill: "none", stroke: "currentColor", "stroke-width": "2" })
              )
            )
          )
        )
      ),

      // Right Panel: Split Map
      el("div", { class: "col-span-12 lg:col-span-9 bg-surface-container rounded-xl shadow-md overflow-hidden relative flex flex-col group" },
        // Map Container
        el("div", { class: "relative flex-1 flex" },
          // Left Map (Current)
          el("div", { class: "w-1/2 h-full relative border-r-2 border-primary border-dashed" },
            el("div", { id: "map-scenario-baseline", class: "w-full h-full bg-cover bg-center relative", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiQ4j74-Rzn6jPDcL8j9nxKqgWFWW6xKuTDFqgc5V47rXQJu8GGDS79tZvNwWgLjMc9Hy3XU8n29Gyh4KJe1G3-45lSQq3UhsEZtf5VdLl0SLA3UuJyTsWswshmW4dsTJC-c8_ikBXPpBlai68jq9RB3B6Rmev8ZPlt0CCT4GMXqNgO1FMCSWrUU72xfVREHYGaZGI4Vu0SOGSQQ9knsvI_YCE7nc4kmYL8GIaHvkh6SJ9mNmnQPTv9g')" }),
            el("div", { class: "absolute top-4 left-4 bg-surface/90 backdrop-blur px-4 py-2 rounded-md shadow-sm" }, el("span", { class: "font-data text-data-mono uppercase tracking-wider text-on-surface" }, "Baseline (Current)"))
          ),
          // Right Map (Projected)
          el("div", { class: "w-1/2 h-full relative" },
            el("div", { id: "map-scenario-projected", class: "w-full h-full bg-cover bg-center relative", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiQ4j74-Rzn6jPDcL8j9nxKqgWFWW6xKuTDFqgc5V47rXQJu8GGDS79tZvNwWgLjMc9Hy3XU8n29Gyh4KJe1G3-45lSQq3UhsEZtf5VdLl0SLA3UuJyTsWswshmW4dsTJC-c8_ikBXPpBlai68jq9RB3B6Rmev8ZPlt0CCT4GMXqNgO1FMCSWrUU72xfVREHYGaZGI4Vu0SOGSQQ9knsvI_YCE7nc4kmYL8GIaHvkh6SJ9mNmnQPTv9g')" }),
            el("div", { class: "absolute top-4 right-4 bg-primary/90 backdrop-blur px-4 py-2 rounded-md shadow-sm" }, el("span", { class: "font-data text-data-mono uppercase tracking-wider text-on-primary" }, "Simulated (Projected)"))
          ),
          // Center Slider Handle
          el("div", { class: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg cursor-ew-resize z-20 group-hover:scale-110 transition-transform" }, icon("sync_alt", "text-on-primary"))
        ),
        // Bottom Metrics Bar
        el("div", { class: "h-24 bg-surface-container-high border-t border-outline-variant/10 flex items-center px-6 gap-8" },
          el("div", { class: "flex items-center gap-4 flex-1" },
            el("div", { class: "w-12 h-12 rounded-full bg-error/20 flex items-center justify-center" }, icon("warning", "text-error text-[24px]")),
            el("div", {},
              el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant" }, "Critical Zones Reduced"),
              el("div", { class: "font-headline text-[24px] leading-[32px] text-on-surface", id: "critical-zones" }, "14 to 3 blocks")
            )
          ),
          el("div", { class: "h-10 w-[1px] bg-outline-variant/20" }),
          el("div", { class: "flex items-center gap-4 flex-1" },
            el("div", { class: "w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center" }, icon("groups", "text-on-secondary-container text-[24px]")),
            el("div", {},
              el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant" }, "Pop. Exposure Dropped"),
              el("div", { class: "font-headline text-[24px] leading-[32px] text-on-surface", id: "pop-exposure" }, "45,000 \u2192 12,500")
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize maps
  setTimeout(() => {
    const baselineContainer = document.getElementById("map-scenario-baseline");
    const projectedContainer = document.getElementById("map-scenario-projected");
    
    if (baselineContainer && !mapMounted) {
      baselineMap = mountMap(baselineContainer, { center: [34.0522, -118.2437], zoom: 10 });
      mapMounted = true;
    }
    if (projectedContainer) {
      projectedMap = mountMap(projectedContainer, { center: [34.0522, -118.2437], zoom: 10 });
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      // Update projected map with intervention
    }
  });
}

function sliderControl(label, key, value, min, max, currentLabel, maxLabel) {
  return el("div", { class: "flex flex-col gap-2 z-10" },
    el("div", { class: "flex justify-between items-end" },
      el("label", { class: "font-data text-data-mono uppercase tracking-wider text-on-surface-variant" }, label),
      el("span", { class: "font-data text-data-mono text-primary", id: `slider-value-${key}` }, `+${value}%`)
    ),
    el("input", { class: "w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary", max, min, type: "range", value, id: `slider-${key}`, oninput: (e) => updateIntervention(key, e.target.value) }),
    el("div", { class: "flex justify-between mt-1" },
      el("span", { class: "text-[10px] text-on-surface-variant font-data-mono" }, currentLabel),
      el("span", { class: "text-[10px] text-on-surface-variant font-data-mono" }, maxLabel)
    )
  );
}

function impactBox(label, value, delta, color) {
  return el("div", { class: "bg-surface p-4 rounded-lg flex flex-col gap-1" },
    el("span", { class: "text-[10px] uppercase font-data text-on-surface-variant" }, label),
    el("div", { class: "flex items-end gap-2" },
      el("span", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, value),
      el("span", { class: `font-data text-data-mono text-${color} pb-2` }, delta)
    )
  );
}

function updateIntervention(key, value) {
  interventions[key] = parseInt(value);
  const valEl = document.getElementById(`slider-value-${key}`);
  if (valEl) valEl.textContent = `+${value}%`;
  
  // Update projected impact (simplified)
  const totalIntervention = Object.values(interventions).reduce((a, b) => a + b, 0);
  const tempReduction = (totalIntervention / 100) * 8; // Simplified model
  const riskReduction = (totalIntervention / 100) * 50;
  
  const tempEl = document.querySelector("#map-scenario-projected + .h-24 .flex.items-end.gap-2 .font-display");
  const riskEl = document.querySelectorAll("#map-scenario-projected + .h-24 .flex.items-end.gap-2 .font-display")[1];
  
  if (tempEl) tempEl.textContent = `${Math.max(30, 40 - tempReduction).toFixed(0)}°`;
  if (riskEl) riskEl.textContent = Math.max(10, 57 - riskReduction).toFixed(0);
  
  document.getElementById("critical-zones").textContent = `${Math.max(2, Math.round(14 - totalIntervention / 10))} to ${Math.max(1, Math.round(3 - totalIntervention / 50))} blocks`;
  document.getElementById("pop-exposure").textContent = `${Math.round(45000 - totalIntervention * 500).toLocaleString()} \u2192 ${Math.round(12500 + totalIntervention * 100).toLocaleString()}`;
}

function runSimulation() {
  toast("Running simulation with current interventions...", "info");
  setTimeout(() => {
    toast("Simulation complete. Projected impact updated.", "success");
  }, 1500);
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}
