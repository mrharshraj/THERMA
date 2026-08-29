// Decision Workspace Screen (from ui/decision_workspace/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadGridLayer, generateReport } from "../lib/api.js";
import { mount as mountMap, drawGrid, clearGrid, drawAoiBounds, addMarker, clearMarkers } from "../lib/map.js";
import { el, icon, toast, severityChip } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;
  const assets = ctx?.assets || [];
  const exposure = ctx?.exposure;
  const mode = route.query?.mode || "split";

  const main = el("main", { class: "flex flex-col h-full" },
    // HERO: RECOMMENDED DECISION & ACTION PLAN
    el("section", { class: "relative w-full bg-surface-container-lowest text-on-surface p-[32px] shadow-xl z-20 flex flex-col justify-between overflow-hidden", style: "min-height: 45vh;" },
      el("div", { class: "absolute inset-0 z-0 opacity-40" },
        el("div", { class: "absolute -top-32 -right-32 w-96 h-96 bg-error rounded-full blur-[120px] mix-blend-screen" }),
        el("div", { class: "absolute top-1/2 -left-16 w-64 h-64 bg-primary rounded-full blur-[90px] mix-blend-screen" })
      ),
      el("div", { class: "relative z-10 flex flex-col h-full justify-between" },
        el("div", { class: "flex justify-between items-start w-full" },
          el("div", { class: "flex flex-col max-w-3xl" },
            el("div", { class: "flex items-center gap-3 mb-6" },
              el("span", { class: "bg-error text-on-error font-data text-data-mono px-3 py-1 uppercase tracking-widest font-bold shadow-md" }, "Critical Action Required"),
              el("span", { class: "font-data text-data-mono text-on-surface-variant uppercase tracking-widest" }, "Sys-Gen Ref: TX-9042")
            ),
            el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface mb-4" }, "Deploy Phase-3 Cool Coating & HVAC Surge to Sector 7"),
            el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-2xl" }, "Sustained thermal anomalies in Sector 7 are projected to cause catastrophic asset failure within 48 hours. Predictive models indicate a 94% success rate for immediate surface treatment coupled with localized cooling surges.")
          ),
          el("div", { class: "bg-surface-container shadow-xl p-6 w-80 flex flex-col gap-4" },
            el("h3", { class: "font-data text-data-mono text-on-surface uppercase tracking-widest" }, "Execution Protocol"),
            protocolStep(1, "Dispatch Response Team Alpha", true),
            protocolStep(2, "Apply Phase-3 Coating", false),
            protocolStep(3, "Route HVAC Surge", false),
            el("button", { class: "mt-4 w-full bg-primary text-on-primary font-headline text-headline py-3 shadow-md hover:shadow-lg transition-shadow", onclick: () => toast("Authorization sent to command chain", "success") }, "AUTHORIZE PLAN")
          )
        )
      )
    ),

    // STAGE 1: UNDERSTAND (Problem Evidence)
    el("section", { class: "p-[32px] bg-surface z-10 relative" },
      stageHeader("01", "Understand"),
      el("div", { class: "grid grid-cols-12 gap-[16px]" },
        el("div", { class: "col-span-12 lg:col-span-8 bg-surface-container shadow-xl h-96 relative overflow-hidden group" },
          el("div", { id: "map-decision-understand", class: "absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDB7vVFrtd08Mptn5JiI3uRGaGPDA6CUdg5Vzfkt-M2ULdVnpmFOzq7s4tCyK7BVN0T7L7iRwx0QJOJu2IeHyT6zI9DBr5raJcT30FEmZC4_e4F813-YeOfcHXZNTAxzmqgEzgpTkBBPFCZfSOcpsXXK0npESdzok6kfX41MVsALgy5_VsF8ts0mydG55VucOECoEXwxVEXObRfxQ1WYVgXNPafIhaOcX-ht-FFHUJLeZlj0gBk4f8Qbw')" }),
          el("div", { class: "absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" }),
          el("div", { class: "absolute bottom-6 left-6 right-6 flex justify-between items-end" },
            el("div", {},
              el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "Thermal Cluster Alpha"),
              el("p", { class: "font-data text-data-mono text-error mt-1" }, "+14.2\u00b0C Above Baseline Variance")
            ),
            el("div", { class: "bg-surface/90 backdrop-blur-md p-4 shadow-lg flex gap-6" },
              statBox("Peak Temp", "48.5\u00b0C", "error"),
              statBox("Exposure Time", "12h 45m", "on-surface")
            )
          )
        ),
        el("div", { class: "col-span-12 lg:col-span-4 flex flex-col gap-[16px]" },
          el("div", { class: "bg-error-container text-on-error-container p-6 shadow-md flex-1 flex flex-col justify-center" },
            icon("warning", "text-[32px] mb-4"),
            el("h4", { class: "font-headline text-[24px] leading-[32px] mb-2" }, "Failure Probability High"),
            el("p", { class: "font-body text-[14px] opacity-90" }, "Transformer Grid 4 is operating at 112% thermal capacity. Imminent thermal runaway detected.")
          ),
          el("div", { class: "bg-surface-container-high p-6 shadow-md flex-1 flex flex-col justify-center" },
            el("div", { class: "flex justify-between items-center mb-4" },
              el("span", { class: "font-data text-data-mono text-on-surface uppercase" }, "Historical Precedents"),
              icon("history", "text-on-surface-variant")
            ),
            el("div", { class: "font-body text-[14px] text-on-surface-variant mb-2" }, "Similar event on 2023-08-12 resulted in 14 hours of downtime. Immediate intervention prevented secondary fires."),
            el("a", { class: "font-data text-data-mono text-primary uppercase tracking-widest hover:opacity-80 transition-opacity", href: "#" }, "View Case Study \u2192")
          )
        )
      )
    ),

    // STAGE 2: COMPARE (Visual Comparison)
    el("section", { class: "p-[32px] bg-surface-container-low relative" },
      stageHeader("02", "Compare Scenarios"),
      el("div", { class: "flex flex-col lg:flex-row gap-[16px]" },
        // Do Nothing Scenario
        el("div", { class: "flex-1 bg-surface-container shadow-lg overflow-hidden relative opacity-70 hover:opacity-100 transition-opacity" },
          el("div", { class: "h-48 bg-cover bg-center", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuB3QF9INHg1YZexizMssU9-IDoNFl4NGrKIYFlsnfBHYNMpnkQ8Yfs8STRiJHBWRfRN8w5jtjDxGok2_2xJyA4-sm7F50x0WcCEaIS6shhQnZWFVvNr1hff5XFiZFPNkQGYSR1wngaZ6rB3fUwhBmxdX5TGG-oIU5wmK5IAO082jtYGKCl5qvBdS4pUEIoxoEyPJjLnrXC7V_0baaDjLbIrecjrAoAbdntCPhU8PTl3osUiuyW5m3h0rw')" }),
          el("div", { class: "p-6" },
            el("div", { class: "inline-block bg-surface-variant text-on-surface-variant px-2 py-1 font-data text-data-mono text-[10px] uppercase mb-4 shadow-sm" }, "Baseline: Do Nothing"),
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-2" }, "Asset Failure cascade"),
            el("p", { class: "font-body text-[14px] text-on-surface-variant mb-6" }, "Unmitigated heat stress leads to cascading grid failures starting with Transformer 4, spreading to adjacent cooling units."),
            el("div", { class: "flex justify-between items-center bg-surface-container-highest p-3" },
              el("span", { class: "font-data text-data-mono text-on-surface-variant" }, "Est. Damages"),
              el("span", { class: "font-headline text-[24px] leading-[32px] text-error" }, "$1.2M")
            )
          )
        ),
        // Action Scenario
        el("div", { class: "flex-1 bg-primary-container text-on-primary-container shadow-xl overflow-hidden relative transform lg:-translate-y-4" },
          el("div", { class: "absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" }),
          el("div", { class: "h-48 bg-cover bg-center", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuCVR_AgDiPktfRzVxi-O817bKSJIzXkZg_ySzZeEFGhd-g2hBKzVJhiGcpJmlNslKVv5JKy80bOthjCX7cRSF54nF1bTkjwx1NpHDXeENUFq2-dKbUcsrSXv3cafEBwOyAZmzYESJfQJcR7xbwbBeumwOU8wsjH-8TNGQ7z0U1M7TyADFvxHhseEZyIPsl-UKslL8ccsfeQfTChUCEbF90eCwI83t9ZF2hLAO8DPwcbNJneOSyjagMCPQ')" }),
          el("div", { class: "p-6 relative z-10" },
            el("div", { class: "inline-block bg-primary text-on-primary px-2 py-1 font-data text-data-mono text-[10px] uppercase mb-4 shadow-sm font-bold" }, "Recommended: Intervention"),
            el("h3", { class: "font-headline text-[24px] leading-[32px] mb-2" }, "Stabilized Operations"),
            el("p", { class: "font-body text-[14px] opacity-90 mb-6" }, "Phase-3 coating reduces surface absorption by 40%. HVAC surge dissipates ambient heat, preventing failure cascade."),
            el("div", { class: "flex justify-between items-center bg-surface-container-highest/30 p-3 shadow-inner" },
              el("span", { class: "font-data text-data-mono" }, "Est. Intervention Cost"),
              el("span", { class: "font-headline text-[24px] leading-[32px]" }, "$45K")
            )
          )
        )
      )
    ),

    // STAGE 3 & 4: PRIORITIZE & ACT
    el("section", { class: "p-[32px] bg-surface relative flex flex-col lg:flex-row gap-[16px]" },
      el("div", { class: "flex-1 flex flex-col" },
        stageHeader("03", "Prioritize Assets"),
        el("div", { class: "flex flex-col gap-4" },
          assetPriority(1, "Transformer Grid 4", "Critical", "48.5\u00b0C", "error", "priority_high"),
          assetPriority(2, "Cooling Tower B", "High", "42.1\u00b0C", "tertiary", "warning"),
          assetPriority(3, "Main Server Hall Exterior", "Elevated", "38.9\u00b0C", "secondary", "info")
        )
      ),
      // Final Act Panel
      el("div", { class: "w-full lg:w-[400px] flex flex-col" },
        stageHeader("04", "Execute"),
        el("div", { class: "bg-surface-container-highest p-6 shadow-xl flex-1 flex flex-col justify-between relative overflow-hidden" },
          el("div", { class: "absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-[40px]" }),
          el("div", { class: "relative z-10" },
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6" }, "Final Authorization"),
            el("div", { class: "space-y-4 mb-8" },
              authRow("Deploy Teams", "Alpha, Bravo"),
              authRow("Est. Time to Mitigate", "2h 15m"),
              authRow("Approval Required", "L3 Commander", "text-primary font-bold")
            ),
            el("button", { class: "relative w-full bg-primary text-on-primary font-headline text-headline py-4 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden group", onclick: () => toast("Workflow initiated", "success") },
              el("div", { class: "absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" }),
              el("span", { class: "relative z-10 flex items-center justify-center gap-2" }, "INITIATE WORKFLOW", icon("rocket_launch"))
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  unsubscribe = subscribe((state) => {
    if (state.context?.heatmap && state.gridLayer) {
      // Update maps if needed
    }
  });
}

function stageHeader(num, title) {
  return el("div", { class: "flex items-center gap-4 mb-8" },
    el("span", { class: "font-display text-[48px] leading-[56px] text-surface-container-highest opacity-50" }, num),
    el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface uppercase tracking-tight" }, title)
  );
}

function protocolStep(num, label, done) {
  return el("div", { class: "flex items-center gap-3" },
    el("div", { class: `w-2 h-2 rounded-full ${done ? "bg-primary" : "bg-surface-variant"}` }),
    el("span", { class: `font-body text-[14px] ${done ? "text-on-surface" : "text-on-surface-variant"}` }, `${num}. ${label}`)
  );
}

function statBox(label, value, color) {
  return el("div", { class: "flex flex-col" },
    el("div", { class: "font-data text-[10px] text-on-surface-variant uppercase mb-1" }, label),
    el("div", { class: `font-headline text-[32px] leading-[40px] text-${color}` }, value)
  );
}

function assetPriority(num, name, risk, temp, color, iconName) {
  return el("div", { class: "bg-surface-container p-4 shadow-md flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer group" },
    el("div", { class: "flex items-center gap-4" },
      el("div", { class: `w-12 h-12 ${color === "error" ? "bg-error-container text-on-error-container" : color === "tertiary" ? "bg-surface-variant text-on-surface" : "bg-surface-variant text-on-surface"} flex items-center justify-center font-headline text-headline shadow-sm" }, num),
      el("div", {},
        el("h4", { class: "font-headline text-[24px] leading-[32px] text-on-surface group-hover:text-primary transition-colors" }, name),
        el("div", { class: "font-data text-data-mono text-on-surface-variant uppercase text-[10px] mt-1" }, `Risk: ${risk} | Temp: ${temp}`)
      )
    ),
    icon(iconName, color === "error" ? "text-error" : color === "tertiary" ? "text-tertiary" : "text-secondary")
  );
}

function authRow(label, value, valueClass = "") {
  return el("div", { class: "flex justify-between items-center" },
    el("span", { class: "font-body text-[14px] text-on-surface-variant" }, label),
    el("span", { class: `font-data text-data-mono text-on-surface ${valueClass}` }, value)
  );
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}