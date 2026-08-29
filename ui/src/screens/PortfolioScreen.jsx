// Portfolio Monitoring Screen (from ui/portfolio_monitoring/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, generateReport } from "../lib/api.js";
import { mount as mountMap, drawGrid, drawAoiBounds, clearGrid, addMarker, clearMarkers } from "../lib/map.js";
import { el, icon, toast, tempF, severityChip, timeAgo } from "../lib/widgets.js";
import { donut, lineChart } from "../lib/charts.js";

let unsubscribe = null;
let mapMounted = false;
let assetsData = [];
let currentPage = 0;
const PAGE_SIZE = 20;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  // Build assets data from context
  if (ctx?.assets) {
    assetsData = ctx.assets.filter(a => a.risk).sort((a, b) => b.risk.index - a.risk.index);
  }

  const main = el("main", { class: "flex flex-col h-full" },
    // Ambient Background
    el("div", { class: "absolute inset-0 pointer-events-none opacity-20" },
      el("div", { class: "absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px] mix-blend-screen" }),
      el("div", { class: "absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-500 rounded-full blur-[150px] mix-blend-screen" })
    ),

    // Header Section
    el("div", { class: "px-[32px] pt-[32px] pb-8 relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6" },
      el("div", {},
        el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-background mb-2" }, "Portfolio Monitoring"),
        el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-2xl" }, "Aggregate intelligence across global assets. Monitoring thermal exposure and operational risk factors in real-time.")
      ),
      el("div", { class: "flex gap-4" },
        el("button", { class: "px-6 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-headline text-body rounded-lg shadow-sm transition-all flex items-center gap-2 group", onclick: exportReport },
          icon("download", "text-[20px] text-outline group-hover:text-primary transition-colors"),
          "Export Report"
        ),
        el("button", { class: "px-6 py-3 bg-primary hover:bg-primary-fixed text-on-primary font-headline text-body rounded-lg shadow-md shadow-primary/20 transition-all flex items-center gap-2", onclick: () => toast("Add Asset functionality coming soon", "info") },
          icon("add", "text-[20px]"),
          "Add Asset"
        )
      )
    ),

    // KPI Grid
    el("div", { class: "px-[32px] pb-[32px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px] relative z-10" },
      kpiCard("Total Assets", "domain", "primary", assetsData.length || 1248, "+2.4% vs last month", "trending_up", "primary"),
      kpiCard("High Risk", "warning", "error", assetsData.filter(a => a.risk?.index >= 4).length || 42, "Immediate Action Required", "warning", "error", true),
      kpiCard("Mod Risk", "remove", "tertiary", assetsData.filter(a => a.risk?.index === 3).length || 315, "Stable trend", "remove", "tertiary"),
      kpiCard("Low Risk", "check_circle", "secondary", assetsData.filter(a => a.risk?.index <= 2).length || 891, "Optimal", "check_circle", "secondary")
    ),

    // Main Content Area: Split View
    el("div", { class: "px-[32px] pb-[32px] grid grid-cols-1 xl:grid-cols-12 gap-[16px] relative z-10 flex-1 min-h-0" },
      // Left Column: Visualizations
      el("div", { class: "xl:col-span-4 flex flex-col gap-[16px]" },
        // Risk Distribution Chart (Donut)
        el("div", { class: "bg-surface-container-low rounded-xl p-6 shadow-md flex-1 min-h-[300px] flex flex-col" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-6" }, "Risk Distribution"),
          el("div", { class: "relative flex-1 flex items-center justify-center" },
            el("div", { id: "risk-donut-chart", class: "w-48 h-48" }),
            el("div", { class: "absolute inset-0 flex flex-col items-center justify-center pointer-events-none" },
              el("span", { class: "font-display text-[48px] leading-[56px] text-on-surface", id: "total-assets-count" }, assetsData.length || 1248),
              el("span", { class: "font-data text-[12px] text-outline" }, "Assets")
            )
          ),
          // Legend
          el("div", { class: "flex justify-center gap-6 mt-6" },
            el("div", { class: "flex items-center gap-2" }, el("div", { class: "w-2 h-2 rounded-full bg-error" }), el("span", { class: "font-data text-[12px] text-on-surface-variant" }, `High (${Math.round((assetsData.filter(a => a.risk?.index >= 4).length / Math.max(1, assetsData.length)) * 100)}%)`)),
            el("div", { class: "flex items-center gap-2" }, el("div", { class: "w-2 h-2 rounded-full bg-tertiary" }), el("span", { class: "font-data text-[12px] text-on-surface-variant" }, `Mod (${Math.round((assetsData.filter(a => a.risk?.index === 3).length / Math.max(1, assetsData.length)) * 100)}%)`)),
            el("div", { class: "flex items-center gap-2" }, el("div", { class: "w-2 h-2 rounded-full bg-secondary" }), el("span", { class: "font-data text-[12px] text-on-surface-variant" }, `Low (${Math.round((assetsData.filter(a => a.risk?.index <= 2).length / Math.max(1, assetsData.length)) * 100)}%)`))
          )
        ),
        // Heat Exposure Trend
        el("div", { class: "bg-surface-container-low rounded-xl p-6 shadow-md flex-1 min-h-[300px] flex flex-col" },
          el("div", { class: "flex justify-between items-center mb-6" },
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "Thermal Exposure Trend"),
            el("select", { class: "bg-surface-container-highest text-on-surface font-data text-[12px] px-3 py-1 rounded-md outline-none cursor-pointer", id: "trend-period" },
              el("option", { value: "7" }, "Last 7 Days"),
              el("option", { value: "30" }, "Last 30 Days")
            )
          ),
          el("div", { class: "relative flex-1 w-full h-full", id: "exposure-trend-chart" })
        )
      ),

      // Right Column: Asset List
      el("div", { class: "xl:col-span-8 bg-surface-container-low rounded-xl shadow-md flex flex-col overflow-hidden" },
        // Controls Bar
        el("div", { class: "p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-high/50" },
          // Search
          el("div", { class: "relative w-full sm:w-72" },
            icon("search", "absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]"),
            el("input", { class: "w-full bg-surface-container-lowest text-on-surface font-body pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-outline-variant", placeholder: "Search assets by name or ID...", type: "text", id: "asset-search" })
          ),
          // Filters & Sort
          el("div", { class: "flex gap-2 w-full sm:w-auto" },
            el("button", { class: "px-3 py-2 bg-surface-container hover:bg-surface-container-highest text-on-surface font-data text-[12px] rounded-lg flex items-center gap-2 transition-colors" }, icon("filter_list", "text-[16px]"), "Filter"),
            el("button", { class: "px-3 py-2 bg-surface-container hover:bg-surface-container-highest text-on-surface font-data text-[12px] rounded-lg flex items-center gap-2 transition-colors", id: "sort-btn" }, icon("sort", "text-[16px]"), "Sort: Risk Desc")
          )
        ),
        // Table Container
        el("div", { class: "flex-1 overflow-auto", id: "table-container" },
          renderAssetTable()
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize visualizations
  setTimeout(() => {
    renderDonutChart();
    renderExposureTrendChart();
    renderAssetTable();
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.context?.assets) {
      assetsData = state.context.assets.filter(a => a.risk).sort((a, b) => b.risk.index - a.risk.index);
      renderAssetTable();
      renderDonutChart();
    }
  });
}

function kpiCard(title, iconName, iconColor, value, sub, trendIcon, trendColor, pulse = false) {
  const colorMap = { primary: "bg-primary", error: "bg-error", tertiary: "bg-tertiary", secondary: "bg-secondary" };
  return el("div", { class: `${colorMap[iconColor] || "bg-primary"}/10 rounded-xl p-6 shadow-md relative overflow-hidden group hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1` },
    el("div", { class: `absolute top-0 left-0 w-1 h-full ${colorMap[iconColor] || "bg-primary"}` }),
    el("div", { class: "flex justify-between items-start mb-4" },
      el("span", { class: "font-data text-[10px] uppercase text-outline tracking-wider" }, title),
      pulse ? el("div", { class: "w-3 h-3 rounded-full bg-error animate-pulse" }) : icon(iconName, "text-outline")
    ),
    el("div", { class: "font-display text-[48px] leading-[56px] text-on-surface mb-2" }, value),
    el("div", { class: `flex items-center gap-2 text-${trendColor}` },
      icon(trendIcon, "text-[16px]"),
      el("span", { class: "font-data text-[12px]" }, sub)
    ),
    // Sparkline for high risk
    pulse ? el("div", { class: "mt-4 h-8 w-full opacity-50 group-hover:opacity-100 transition-opacity" },
      el("svg", { class: "w-full h-full stroke-current", preserveAspectRatio: "none", viewBox: "0 0 100 20" },
        el("path", { d: "M0 15 Q 10 10 20 18 T 40 5 T 60 12 T 80 2 T 100 8", fill: "none", "stroke-linecap": "round", "stroke-width": "2" })
      )
    ) : null
  );
}

function renderDonutChart() {
  const container = document.getElementById("risk-donut-chart");
  const totalEl = document.getElementById("total-assets-count");
  if (!container) return;

  const high = assetsData.filter(a => a.risk?.index >= 4).length;
  const mod = assetsData.filter(a => a.risk?.index === 3).length;
  const low = assetsData.filter(a => a.risk?.index <= 2).length;
  const total = assetsData.length || 1248;

  if (totalEl) totalEl.textContent = total.toLocaleString();

  const segments = [
    { label: "Low", value: low || 891, color: "#c5c7c8" },
    { label: "Mod", value: mod || 315, color: "#ffb59d" },
    { label: "High", value: high || 42, color: "#ffb4ab" }
  ];

  container.innerHTML = "";
  container.appendChild(donut({ segments, centerLabel: total.toLocaleString(), centerSub: "Assets" }));
}

function renderExposureTrendChart() {
  const container = document.getElementById("exposure-trend-chart");
  if (!container) return;

  // Generate 7 days of mock trend data based on assets
  const days = 7;
  const trendData = Array.from({ length: days }, (_, i) => {
    const base = assetsData.length > 0 ? assetsData.reduce((sum, a) => sum + (a.tempC || 30), 0) / assetsData.length : 35;
    return Math.round((base + (Math.random() - 0.5) * 4) * 10) / 10;
  });

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, days);

  container.innerHTML = "";
  container.appendChild(lineChart({
    labels,
    series: [{ name: "Avg Temp (\u00b0C)", color: "#ffb59d", points: trendData }],
    yFmt: v => `${v}\u00b0C`,
    area: true
  }));

  // X-axis labels
  const xLabels = el("div", { class: "flex justify-between mt-2 px-1 font-data text-[10px] text-outline" },
    ...labels.map(l => el("span", {}, l))
  );
  container.appendChild(xLabels);
}

function renderAssetTable() {
  const container = document.getElementById("table-container");
  if (!container) return;

  const searchTerm = document.getElementById("asset-search")?.value?.toLowerCase() || "";
  const filteredAssets = assetsData.filter(a => 
    a.name.toLowerCase().includes(searchTerm) || 
    a.id.toLowerCase().includes(searchTerm)
  );

  // Pagination
  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE);
  if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
  const pageAssets = filteredAssets.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const table = el("table", { class: "w-full text-left border-collapse" },
    el("thead", { class: "bg-surface-container-low sticky top-0 z-10 shadow-sm" },
      el("tr", {},
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Asset Name"),
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Location"),
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Temp (Avg)"),
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Heat Risk"),
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Exposure (Hrs)"),
        el("th", { class: "px-6 py-4 font-data text-[10px] uppercase text-outline tracking-wider font-bold text-right" }, "Priority")
      )
    ),
    el("tbody", { class: "divide-y divide-outline-variant/5" },
      ...pageAssets.map((asset, i) => assetRow(asset, i))
    )
  );

  container.innerHTML = "";
  container.appendChild(table);
  container.appendChild(paginationFooter(totalPages));
}

function assetRow(asset, index) {
  const risk = asset.risk;
  const riskColors = {
    Critical: { bg: "bg-error/10", text: "text-error", dot: "bg-error", label: "Critical" },
    High: { bg: "bg-error/10", text: "text-error", dot: "bg-error", label: "High" },
    Elevated: { bg: "bg-tertiary/10", text: "text-tertiary", dot: "bg-tertiary", label: "Elevated" },
    Moderate: { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500", label: "Moderate" },
    Low: { bg: "bg-secondary/10", text: "text-secondary", dot: "bg-secondary", label: "Normal" },
    Minimal: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary", label: "Minimal" }
  };
  const rc = riskColors[risk?.band] || riskColors.Low;

  // Category icon
  const catIcons = { healthcare: "local_hospital", energy: "bolt", logistics: "local_shipping", transport: "directions_bus", water: "water_drop", parks: "park", communications: "cell_tower", commercial: "storefront", education: "school" };
  const catIcon = catIcons[asset.category] || "domain";

  return el("tr", { class: "hover:bg-surface-container-highest/50 transition-colors group cursor-pointer" },
    el("td", { class: "px-6 py-4" },
      el("div", { class: "flex items-center gap-3" },
        el("div", { class: "w-8 h-8 rounded-md overflow-hidden shrink-0" },
          el("div", { class: "w-full h-full bg-cover bg-center", style: `background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFh4IJew5lawZd7SiS7f0NCHUSWMwGXoc7QUMawwk2UgxWIdkU7lGUxVAtoQ42c3Ho3m-8qiKXfYt8e1rhBh92a6U40DIRW1SsU7egAefqj701HQ-gsYLqN4VkdHl78M4C6lK9TjkvoavyDjXOoYGykgRTTI02YUlMWpUYILLCXxuc69lfkireyhJsHfwyb4qTmreZLk5O-ah-8nqmJXIkRqHXtpNMQWSgDVENoKIEIByTlmQX6iuD0A')` })
        ),
        el("div", {},
          el("div", { class: "font-headline text-[14px] text-on-surface group-hover:text-primary transition-colors" }, asset.name),
          el("div", { class: "font-data text-[10px] text-outline" }, `ID: ${asset.id}`)
        )
      )
    ),
    el("td", { class: "px-6 py-4 font-body text-[14px] text-on-surface-variant" }, `${asset.lat.toFixed(2)}, ${asset.lon.toFixed(2)}`),
    el("td", { class: "px-6 py-4 font-data text-[14px] text-on-surface" }, asset.tempC != null ? `${asset.tempC.toFixed(1)}\u00b0C` : "\u2014"),
    el("td", { class: "px-6 py-4" },
      el("span", { class: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${rc.bg} ${rc.text} font-data text-[12px]` },
        el("div", { class: `w-1.5 h-1.5 rounded-full ${rc.dot}` }),
        rc.label
      )
    ),
    el("td", { class: "px-6 py-4 font-data text-[14px] text-on-surface" }, asset.tempF ? `${(asset.tempF * 0.33).toFixed(1)}` : (risk?.index >= 4 ? "14.2" : risk?.index === 3 ? "6.4" : "0.0")),
    el("td", { class: "px-6 py-4 text-right" },
      el("button", { class: `w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${risk?.index >= 4 ? "bg-error/20 text-error hover:bg-error/30" : "bg-surface-container text-outline hover:text-on-surface"}` },
        icon(risk?.index >= 4 ? "priority_high" : "more_vert", "text-[16px]")
      )
    )
  );
}

function paginationFooter(totalPages) {
  return el("div", { class: "p-4 border-t border-outline-variant/10 bg-surface-container-low flex justify-between items-center text-on-surface-variant font-data text-[12px]" },
    el("span", {}, `Showing ${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, assetsData.length)} of ${assetsData.length}`),
    el("div", { class: "flex gap-2" },
      el("button", { class: "w-8 h-8 rounded bg-surface-container flex items-center justify-center hover:bg-surface-container-highest transition-colors opacity-50 cursor-not-allowed", disabled: currentPage === 0 }, icon("chevron_left", "text-[18px]")),
      el("button", { class: "w-8 h-8 rounded bg-surface-container flex items-center justify-center hover:bg-surface-container-highest transition-colors", disabled: currentPage >= totalPages - 1 }, icon("chevron_right", "text-[18px]"))
    )
  );
}

async function exportReport() {
  const st = getState();
  if (!st.context) return toast("No context loaded", "error");
  try {
    const rep = await generateReport(JSON.parse(JSON.stringify(st.context)));
    toast("Report generated", "success");
    window.open(`/api/reports/${rep.id}`, "_blank");
  } catch (err) {
    toast(err.message || "Export failed", "error");
  }
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
  clearMarkers();
}
