// Zoe Operator Workspace Screen (from ui/zoe_operator_workspace/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, executeForWorkspace } from "../lib/api.js";
import { mount as mountMap, drawGrid, clearGrid } from "../lib/map.js";
import { el, icon, toast, severityChip } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "bg-surface font-body h-full";

  const st = getState();
  const ctx = st.context;

  const main = el("main", { class: "w-full flex-1 p-[16px] grid grid-cols-12 gap-[16px] min-h-[870px]" },
    // LEFT: ZOE OPERATOR WORKSPACE
    el("div", { class: "col-span-12 lg:col-span-3 flex flex-col bg-surface-container shadow-xl rounded-xl overflow-hidden relative" },
      // Zoe Header
      el("div", { class: "bg-primary px-4 py-3 flex items-center justify-between shadow-md z-10 text-on-primary" },
        el("div", { class: "flex items-center gap-2" },
          icon("psychology", "text-[20px]"),
          el("span", { class: "font-data text-data-mono uppercase tracking-widest font-bold" }, "Zoe Workspace")
        ),
        el("div", { class: "flex items-center gap-2" },
          el("div", { class: "relative flex h-2 w-2" },
            el("span", { class: "animate-ping absolute inline-flex h-full w-full rounded-full bg-surface opacity-75" }),
            el("span", { class: "relative inline-flex rounded-full h-2 w-2 bg-surface" })
          ),
          el("span", { class: "font-data text-[10px] uppercase font-bold text-on-primary" }, "Active")
        )
      ),
      // Chat History
      el("div", { class: "flex-1 overflow-y-auto p-4 flex flex-col gap-6", id: "chat-container" },
        // User Request
        el("div", { class: "self-end w-4/5 bg-surface-container-highest text-on-surface p-3 rounded-xl shadow-sm rounded-tr-none border border-outline-variant/10" },
          el("p", { class: "font-body text-[14px]" }, "Assess thermal risk and infrastructure vulnerability for Urban Zone 4.")
        ),
        // Zoe Analysis Phase
        el("div", { class: "self-start w-11/12 flex gap-3" },
          el("div", { class: "w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg shrink-0 text-on-primary" }, icon("psychology", "text-[18px]")),
          el("div", { class: "flex flex-col gap-2" },
            el("div", { class: "bg-surface-container-low text-on-surface p-3 rounded-xl shadow-sm rounded-tl-none border border-outline-variant/5" },
              el("div", { class: "flex items-center gap-2 mb-2 text-primary" },
                el("div", { class: "relative flex h-2 w-2" },
                  el("span", { class: "animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" }),
                  el("span", { class: "relative inline-flex rounded-full h-2 w-2 bg-primary" })
                ),
                el("span", { class: "font-data text-[10px] uppercase font-bold tracking-widest" }, "Live Analysis")
              ),
              el("p", { class: "font-body text-[14px] mb-3" }, "Cross-referencing surface peak data (142°F) with substation load capacities. Zone 4 is currently operating at 92% thermal threshold."),
              // System Insight Block
              el("div", { class: "bg-surface-container-highest/50 border-l-2 border-tertiary p-3 rounded-r-lg mb-3" },
                el("div", { class: "text-[10px] font-data-mono uppercase text-tertiary mb-1" }, "System Insight"),
                el("p", { class: "text-[13px] text-on-surface-variant leading-relaxed" }, "Predictive modeling suggests a 14% temperature increase over the next 24h. Substation Alpha is at critical risk of cascading failure.")
              ),
              el("div", { class: "bg-surface-container-highest p-3 rounded-lg shadow-inner flex flex-col gap-2 relative overflow-hidden" },
                el("div", { class: "flex items-center justify-between text-on-surface-variant font-data text-data-mono" },
                  el("span", {}, "Model Convergence"),
                  el("span", { id: "progress-text" }, "94%")
                ),
                el("div", { class: "w-full bg-surface h-1 rounded-full overflow-hidden" },
                  el("div", { class: "bg-tertiary h-full rounded-full transition-all duration-300", id: "progress-bar", style: "width: 94%;" })
                )
              )
            )
          )
        ),
        // Zoe Proposal
        el("div", { class: "self-start w-11/12 flex gap-3" },
          el("div", { class: "w-8 h-8 rounded-full bg-transparent flex items-center justify-center shrink-0" }),
          el("div", { class: "bg-surface-container-low text-on-surface p-3 rounded-xl shadow-sm rounded-tl-none border border-outline-variant/5" },
            el("p", { class: "font-body text-[14px]" }, "I recommend immediate deployment of reflective cool-coatings on Substation Alpha and Transit Hub Beta. This could reduce localized surface peaks by up to 18°F.")
          )
        )
      ),
      // Suggested Commands & Input
      el("div", { class: "p-4 bg-surface-container shadow-[0_-4px_20px_rgba(0,0,0,0.2)] flex flex-col gap-3 z-10" },
        el("div", { class: "flex flex-wrap gap-2" },
          suggestedCmd("layers", "Simulate Cool Coating Impact"),
          suggestedCmd("search_insights", "Identify Vulnerable Substations"),
          suggestedCmd("description", "Export Risk Report")
        ),
        el("div", { class: "bg-surface-container-lowest flex items-center px-4 py-2 rounded-full shadow-inner" },
          el("input", { class: "bg-transparent flex-1 font-body text-body text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none", placeholder: "Command Zoe...", type: "text", id: "zoe-input" }),
          el("button", { class: "text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full flex items-center justify-center", onclick: () => sendZoeCommand() }, icon("mic", "text-[18px]", true))
        )
      )
    ),

    // CENTER: DYNAMIC VISUALIZATION
    el("div", { class: "col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl shadow-xl relative overflow-hidden flex flex-col group" },
      // Map Background
      el("div", { id: "map-zoe", class: "absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-100 group-hover:scale-105 opacity-80 mix-blend-luminosity" }),
      // Thermal Overlay Gradient
      el("div", { class: "absolute inset-0 bg-gradient-to-br from-error/20 via-surface/40 to-surface/90 pointer-events-none" }),
      // Simulated Map Scanning Line
      el("div", { class: "absolute left-0 right-0 h-[2px] bg-tertiary shadow-[0_0_15px_3px_#ffb59d] opacity-50 z-10 pointer-events-none", id: "scanner", style: "top: 102%;" }),
      // Center UI Overlays
      el("div", { class: "relative z-20 p-6 flex-1 flex flex-col justify-between pointer-events-none" },
        el("div", { class: "flex justify-between items-start" },
          el("div", { class: "bg-surface/80 backdrop-blur-md px-4 py-2 rounded-lg shadow-md pointer-events-auto flex items-center gap-3" },
            icon("crisis_alert", "text-error animate-pulse"),
            el("div", {},
              el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant font-bold tracking-widest" }, "Active Focus"),
              el("div", { class: "font-headline text-[24px] text-on-surface" }, "Zone 4 Thermal Model")
            )
          ),
          el("div", { class: "flex flex-col gap-2 pointer-events-auto" },
            mapControlBtn("zoom_in", () => map?.zoomBy(1)),
            mapControlBtn("zoom_out", () => map?.zoomBy(-1)),
            mapControlBtn("layers", () => {})
          )
        ),
        // Predictive Graph Overlay
        el("div", { class: "bg-surface/90 backdrop-blur-xl p-4 rounded-xl shadow-2xl pointer-events-auto w-full max-w-xl" },
          el("div", { class: "flex justify-between items-end mb-4" },
            el("div", {},
              el("div", { class: "font-data text-[10px] uppercase text-outline font-bold tracking-widest mb-1" }, "Temperature Projection (48h)"),
              el("div", { class: "font-headline text-[24px] text-on-surface flex items-center gap-2" }, "112°F ", icon("trending_up", "text-error text-[20px]"))
            ),
            el("div", { class: "font-data text-data-mono text-tertiary bg-tertiary/10 px-2 py-1 rounded shadow-sm" }, "+14% vs Baseline")
          ),
          el("svg", { class: "w-full h-24 overflow-visible", preserveAspectRatio: "none", viewBox: "0 0 400 100" },
            el("path", { class: "text-tertiary/30", d: "M 0 80 Q 50 80 100 60 T 200 40 T 300 10 T 400 20", fill: "none", stroke: "currentColor", "stroke-dasharray": "4 4", "stroke-width": "2" }),
            el("path", { class: "text-tertiary drop-shadow-[0_0_8px_rgba(255,181,157,0.8)]", d: "M 0 80 Q 50 80 100 60 T 200 40 T 300 10 T 400 20", fill: "none", id: "live-line", stroke: "currentColor", "stroke-dasharray": "500", "stroke-dashoffset": "500", "stroke-width": "3" }),
            el("circle", { class: "text-error animate-ping", cx: "300", cy: "10", fill: "currentColor", r: "4" }),
            el("circle", { class: "text-error", cx: "300", cy: "10", fill: "currentColor", r: "4" })
          ),
          el("div", { class: "flex justify-between mt-2 font-data text-[10px] text-on-surface-variant uppercase" },
            el("span", {}, "Now"),
            el("span", {}, "+12h"),
            el("span", {}, "+24h"),
            el("span", { class: "text-error font-bold" }, "Peak Risk"),
            el("span", {}, "+48h")
          )
        )
      ),

    // RIGHT: CONTEXT & ASSETS
    el("div", { class: "col-span-12 lg:col-span-3 flex flex-col gap-[16px] h-full" },
      // Current Status Card
      el("div", { class: "bg-surface-container shadow-lg rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden" },
        el("div", { class: "absolute -right-10 -top-10 w-32 h-32 bg-error/10 rounded-full blur-2xl" }),
        el("div", {},
          el("h2", { class: "font-data text-[10px] uppercase text-outline font-bold tracking-widest mb-1" }, "Contextual Status"),
          el("div", { class: "font-headline text-[32px] leading-[40px] text-on-surface" }, "Severe Risk")
        ),
        el("div", { class: "grid grid-cols-2 gap-4" },
          statBox("Ambient Max", "109°F", "error"),
          statBox("Surface Peak", "142°F", "tertiary")
        )
      ),
      // Vulnerable Assets List
      el("div", { class: "flex-1 bg-surface-container shadow-lg rounded-xl p-5 flex flex-col" },
        el("div", { class: "flex justify-between items-center mb-4" },
          el("h3", { class: "font-data text-[10px] uppercase text-outline font-bold tracking-widest" }, "Selected Assets"),
          el("span", { class: "font-data text-[10px] bg-surface-container-highest text-on-surface px-2 py-0.5 rounded shadow-sm" }, "4 Identified")
        ),
        el("div", { class: "flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar" },
          assetItem("bolt", "Substation Alpha", "Power Grid • ID 992-A", "94%", "error"),
          assetItem("directions_bus", "Transit Hub Beta", "Public Trans • ID 104-T", "72%", "tertiary"),
          assetItem("water_drop", "Pump Station 4", "Water Infra • ID 441-W", "41%", "secondary", true)
        ),
        el("button", { class: "mt-4 w-full bg-on-surface text-surface py-2 rounded-lg font-data text-data-mono uppercase font-bold tracking-wider hover:opacity-90 transition-opacity shadow-md", onclick: () => toast("Executing protocol...", "info") },
          "Execute Protocol"
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-zoe");
    if (mapContainer && !mapMounted) {
      const map = mountMap(mapContainer, { center: [33.4484, -112.074], zoom: 10 });
      mapMounted = true;
      animateScanner();
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      // Update map if needed
    }
  });
}

function suggestedCmd(iconName, label) {
  return el("button", { class: "bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors font-data text-[11px] px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-wider", onclick: () => toast(`Executing: ${label}`, "info") },
    icon(iconName, "text-[14px]"),
    label
  );
}

function assetItem(iconName, name, meta, vuln, color, dim = false) {
  return el("div", { class: `bg-surface-container-high p-3 rounded-lg shadow-md flex items-center justify-between group cursor-pointer transition-transform hover:-translate-y-1 ${dim ? "opacity-70" : ""}` },
    el("div", { class: "flex items-center gap-3" },
      el("div", { class: `w-10 h-10 rounded bg-${color}/20 text-${color} flex items-center justify-center shadow-inner` }, icon(iconName, "text-[20px]")),
      el("div", {},
        el("div", { class: "font-body text-[14px] text-on-surface font-semibold line-clamp-1" }, name),
        el("div", { class: "font-data text-[10px] text-on-surface-variant" }, meta)
      )
    ),
    el("div", { class: "text-right" },
      el("div", { class: `font-data text-data-mono text-${color} font-bold` }, vuln),
      el("div", { class: "font-data text-[9px] uppercase text-on-surface-variant" }, "Vuln")
    )
  );
}

function statBox(label, value, color) {
  return el("div", { class: "flex flex-col" },
    el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant mb-1" }, label),
    el("div", { class: `font-headline text-[24px] leading-[32px] text-${color}` }, value)
  );
}

function mapControlBtn(iconName, action) {
  return el("button", { class: "w-10 h-10 bg-surface/80 backdrop-blur-md text-on-surface flex items-center justify-center rounded-lg shadow-md hover:bg-primary hover:text-on-primary transition-all", onclick: action }, icon(iconName));
}

function animateScanner() {
  const scanner = document.getElementById('scanner');
  let pos = 0;
  let dir = 1;
  if (scanner) {
    setInterval(() => {
      pos += dir * 2;
      if (pos > 100 || pos < 0) dir *= -1;
      scanner.style.top = `${pos}%`;
    }, 50);
  }
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
}
