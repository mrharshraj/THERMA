// Risk & Insurance Screen (from ui/risk_insurance_analysis/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, generateReport } from "../lib/api.js";
import { el, icon, toast, severityChip } from "../lib/widgets.js";
import { donut, lineChart, barChart } from "../lib/charts.js";

let unsubscribe = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "grid grid-cols-12 gap-[16px] px-[32px] py-[32px] h-full";

  const st = getState();
  const ctx = st.context;
  const assets = ctx?.assets || [];
  const exposure = ctx?.exposure;

  // Compute risk scores
  const thermalScore = exposure?.score || 78;
  const propertyScore = Math.round((assets.filter(a => a.risk?.index >= 3).length / Math.max(1, assets.length)) * 100) || 65;
  const envScore = ctx?.environment?.current?.heatIndexC > 40 ? 91 : 70;
  const sensitivityScore = 58;
  const overallScore = Math.round((thermalScore * 0.25 + propertyScore * 0.35 + envScore * 0.2 + sensitivityScore * 0.2)) || 78;

  const main = el("div", { class: "h-full" },
    // Portfolio Heat Risk Score
    el("div", { class: "col-span-12 xl:col-span-8 flex flex-col gap-[32px]" },
      el("div", { class: "bg-surface-container shadow-xl rounded-xl p-[32px] relative overflow-hidden group" },
        el("div", { class: "absolute -right-20 -top-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-1000" }),
        el("div", { class: "relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-[32px]" },
          el("div", {},
            el("div", { class: "font-data text-outline uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2" }, el("span", { class: "w-2 h-2 rounded-full bg-error animate-pulse" }), "Live Assessment"),
            el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface mb-2" }, "Portfolio Heat Risk Score"),
            el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-2xl" }, "Aggregate vulnerability assessment across monitored assets, translating thermal exposure into financial and insurability metrics.")
          ),
          el("div", { class: "shrink-0 flex items-center justify-center relative" },
            el("svg", { class: "w-40 h-40 transform -rotate-90", viewBox: "0 0 100 100" },
              el("circle", { class: "stroke-surface-bright", cx: "50", cy: "50", fill: "none", r: "45", stroke: "currentColor", "stroke-width": "8" }),
              el("circle", { class: "stroke-error transition-all duration-1000 ease-out", cx: "50", cy: "50", fill: "none", r: "45", stroke: "currentColor", "stroke-dasharray": "283", "stroke-dashoffset": (283 * (1 - overallScore / 100)).toFixed(1), "stroke-linecap": "round", "stroke-width": "8" })
            ),
            el("div", { class: "absolute flex flex-col items-center justify-center" },
              el("span", { class: "font-display text-[56px] font-bold text-on-surface leading-none tracking-tighter" }, overallScore),
              el("span", { class: "font-data text-[12px] text-error font-semibold tracking-wider" }, "CRITICAL")
            )
          )
        )
      ),

      // Risk Factor Cards
      el("div", { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px]" },
        riskFactorCard("Thermal", "thermostat", "25% WGT", thermalScore, "Exposure to extreme events", "error", "M0,30 L20,15 L40,20 L60,5 L80,10 L100,2"),
        riskFactorCard("Property", "domain", "35% WGT", propertyScore, "Structural vulnerability", "on-surface", "M0,25 L20,28 L40,15 L60,20 L80,10 L100,12"),
        riskFactorCard("Environment", "eco", "20% WGT", envScore, "UHI and canopy cover", "error", "M0,30 L20,25 L40,15 L60,5 L80,8 L100,0"),
        riskFactorCard("Sensitivity", "memory", "20% WGT", sensitivityScore, "Operational tolerance", "primary", "M0,10 L20,15 L40,5 L60,20 L80,25 L100,20")
      ),

      // Financial Loss Exposure
      el("div", { class: "bg-surface-container rounded-xl p-[32px] shadow-md flex flex-col gap-6" },
        el("div", { class: "flex items-center justify-between" },
          el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface" }, "Financial Loss Exposure"),
          el("div", { class: "flex items-center gap-4 bg-surface px-4 py-2 rounded-full" },
            el("span", { class: "font-data text-[12px] text-on-surface-variant uppercase" }, "Time Horizon"),
            el("select", { class: "bg-transparent text-on-surface font-data text-[14px] outline-none border-none" },
              el("option", { value: "2030" }, "2030 (RCP 4.5)"),
              el("option", { value: "2050_45" }, "2050 (RCP 4.5)"),
              el("option", { value: "2050_85" }, "2050 (RCP 8.5)")
            )
          )
        ),
        el("div", { class: "relative w-full h-64 bg-surface rounded-lg flex items-end pt-8 px-4 pb-4 gap-2" },
          el("div", { class: "absolute inset-0 grid grid-rows-4 pointer-events-none px-4" },
            el("div", { class: "border-b border-surface-bright/50 w-full h-full relative" }, el("span", { class: "absolute -top-3 right-0 text-[10px] font-data text-outline" }, "$5M")),
            el("div", { class: "border-b border-surface-bright/50 w-full h-full relative" }, el("span", { class: "absolute -top-3 right-0 text-[10px] font-data text-outline" }, "$3.75M")),
            el("div", { class: "border-b border-surface-bright/50 w-full h-full relative" }, el("span", { class: "absolute -top-3 right-0 text-[10px] font-data text-outline" }, "$2.5M")),
            el("div", { class: "border-b border-surface-bright/50 w-full h-full relative" }, el("span", { class: "absolute -top-3 right-0 text-[10px] font-data text-outline" }, "$1.25M"))
          ),
          el("div", { class: "flex-1 flex flex-col justify-end group relative z-10" },
            lossBar(0.3, "primary", "Q1"),
            lossBar(0.45, "primary", "Q2"),
            lossBar(0.65, "tertiary", "Q3"),
            lossBar(0.9, "error", "Q4"),
            lossBar(0.5, "tertiary", "Q5"),
            lossBar(0.35, "primary", "Q6")
          )
        )
      )
    ),

    // Right Column: Why at risk & Mitigation
    el("div", { class: "col-span-12 xl:col-span-4 flex flex-col gap-[32px]" },
      el("div", { class: "bg-error-container text-on-error-container rounded-xl p-[32px] shadow-lg relative overflow-hidden" },
        el("div", { class: "absolute right-0 top-0 opacity-10 transform translate-x-1/3 -translate-y-1/3" }, icon("warning", "text-[180px]")),
        el("div", { class: "relative z-10" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] mb-4 flex items-center gap-2" }, icon("analytics"), "Why at risk?"),
          el("ul", { class: "space-y-4" },
            riskReason("Primary Driver", "HVAC systems rated for 35°C max ambient; expected to exceed 42°C for 14+ days/yr by 2030."),
            riskReason("Secondary Driver", "Located in high-density urban canyon (UHI +4°C) with <5% localized canopy cover.")
          )
        )
      ),
      el("div", { class: "bg-surface-container rounded-xl p-[32px] shadow-md flex-1" },
        el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6 flex items-center gap-2" }, icon("build", "text-primary"), "Mitigation Pathways"),
        el("div", { class: "space-y-4" },
          mitigationItem("HVAC Upgrade", "Install high-ambient rated chilling units. Reduces operational downtime risk by 85%.", "High CAPEX", -15, "$450k", "primary"),
          mitigationItem("Cool Roof Coating", "High-albedo application to 4,000 sqm roof surface. Lowers internal cooling load by 12%.", "Med CAPEX", -8, "$85k", "tertiary")
        ),
        el("button", { class: "w-full py-4 bg-primary text-on-primary font-headline text-[16px] rounded-lg shadow-sm hover:shadow-md transition-all mt-4 flex items-center justify-center gap-2", onclick: () => generateInsuranceBrief() },
          icon("summarize"),
          "Generate Insurance Brief"
        )
      )
    )
  );

  host.appendChild(main);

  unsubscribe = subscribe((state) => {
    if (state.context) {
      // Update risk scores when context changes
    }
  });
}

function riskFactorCard(label, iconName, weight, score, desc, color, sparklinePath) {
  return el("div", { class: "bg-surface-container rounded-xl p-[16px] hover:bg-surface-container-high transition-colors shadow-sm" },
    el("div", { class: "flex items-center justify-between mb-4" },
      icon(iconName, "text-outline"),
      el("span", { class: "font-data text-[12px] text-on-surface-variant" }, weight)
    ),
    el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-1" }, label),
    el("p", { class: "font-body text-[14px] leading-[20px] text-on-surface-variant mb-4" }, desc),
    el("div", { class: "flex items-end justify-between" },
      el("span", { class: `font-data text-[24px] text-on-surface` }, `${score}/100`),
      el("svg", { class: `w-16 h-8 text-${color}`, preserveAspectRatio: "none", viewBox: "0 0 100 30" },
        el("path", { d: sparklinePath, fill: "none", stroke: "currentColor", "stroke-linejoin": "round", "stroke-width": "2" })
      )
    )
  );
}

function riskReason(driver, detail) {
  return el("li", { class: "flex items-start gap-3" },
    icon("arrow_right", "text-[20px] mt-0.5 opacity-80"),
    el("div", {},
      el("span", { class: "block font-data text-[12px] uppercase opacity-70 mb-1" }, driver),
      el("span", { class: "font-body text-[14px] leading-[20px]" }, detail)
    )
  );
}

function mitigationItem(title, desc, capex, riskReduction, cost, color) {
  return el("div", { class: "p-4 bg-surface rounded-lg hover:bg-surface-bright transition-colors cursor-pointer group border-l-2 border-primary" },
    el("div", { class: "flex justify-between items-start mb-2" },
      el("h4", { class: "font-headline text-[18px] text-on-surface group-hover:text-primary transition-colors" }, title),
      el("span", { class: "font-data text-[12px] text-on-surface-variant bg-surface-container-high px-2 py-1 rounded" }, capex)
    ),
    el("p", { class: "font-body text-[14px] text-on-surface-variant mb-3" }, desc),
    el("div", { class: "flex items-center gap-4" },
      el("div", { class: "flex items-center gap-1" }, icon("trending_down", "text-[16px] text-outline"), el("span", { class: "font-data text-[12px] text-on-surface" }, `${riskReduction} Risk Score`)),
      el("div", { class: "flex items-center gap-1" }, icon("payments", "text-[16px] text-outline"), el("span", { class: "font-data text-[12px] text-on-surface" }, cost))
    )
  );
}

function lossBar(ratio, color, label) {
  return el("div", { class: "flex-1 flex flex-col justify-end group relative z-10" },
    el("div", { class: `bg-${color}/${color === "error" ? "60" : color === "tertiary" ? "40" : "20"} w-full h-[${ratio * 100}%] rounded-t-sm group-hover:bg-${color}/${color === "error" ? "80" : "60"} transition-colors${color === "error" ? " shadow-[0_0_15px_rgba(255,180,171,0.2)]" : ""}` }),
    el("div", { class: "absolute -bottom-6 w-full text-center font-data text-[10px] text-on-surface-variant" }, label)
  );
}

function generateInsuranceBrief() {
  const st = getState();
  if (!st.context) return toast("No context loaded", "error");
  generateReport(JSON.parse(JSON.stringify(st.context))).then(rep => {
    toast("Insurance brief generated", "success");
    window.open(`/api/reports/${rep.id}`, "_blank");
  }).catch(err => toast(err.message || "Generation failed", "error"));
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}
