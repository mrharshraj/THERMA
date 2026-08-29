// Active Alerts Screen (from ui/active_alerts_center/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor } from "../lib/api.js";
import { mount as mountMap, drawGrid, clearGrid, drawAoiBounds } from "../lib/map.js";
import { el, icon, toast, severityChip, timeAgo } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;
let selectedAlertId = null;
let filterSeverity = "all";

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex h-full";

  const st = getState();
  const ctx = st.context;
  const alerts = ctx?.alerts || [];
  const place = ctx?.location || st.place;

  const main = el("main", { class: "flex h-full" },
    // Left Sidebar: Alert List & Filters
    el("div", { class: "w-1/3 flex flex-col bg-surface border-r border-outline-variant/20 z-10" },
      // Header
      el("div", { class: "px-[32px] py-[16px] flex flex-col gap-4 border-b border-outline-variant/20 shrink-0" },
        el("div", {},
          el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, "Alerts"),
          el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant mt-2" }, "Active thermal risk events across operational sectors.")
        ),
        // Filters
        el("div", { class: "flex flex-wrap gap-2", id: "alert-filters" },
          filterBtn("All", "all", true),
          filterBtn("Critical (3)", "critical", false, "error"),
          filterBtn("High (7)", "high", false, "tertiary"),
          filterBtn("Moderate (4)", "moderate", false, "secondary")
        )
      ),
      // Alert List (Scrollable)
      el("div", { class: "flex-1 overflow-y-auto px-[32px] py-[16px] space-y-4", id: "alert-list" },
        ...filteredAlerts(alerts).map(alert => alertCard(alert))
      )
    ),
    // Right Content: Alert Details & Context
    el("div", { class: "w-2/3 flex flex-col bg-surface relative", id: "alert-details-container" },
      // Background Map Layer
      el("div", { class: "absolute inset-0 z-0" },
        el("div", { id: "map-alerts", class: "w-full h-full bg-cover bg-center", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDnngbaSCFoKBxVSZ8yo7Y8eAjMztWllYbSO5baH8rz380elgqcd-VuTSlHm2J1h3SbaN6Ycr2v1aeEupDJkqzqPCpaZXnZoFWYnvIqW1q42r_YDko9NmXbytDrVn9DMnNUsyR3uHBqVpeLwRhKKgkj80Uq45PydYBgdszXta2qB2SAbMeYwGOprQFdu0fQfZQBMqJ26G2lYOYsGmib_PgDlYWmnEYDEuCBJZ-PrCp7Lj0mStco9SKasA')" }),
        el("div", { class: "absolute inset-0 bg-background/60 backdrop-blur-[2px]" })
      ),
      // Detail Overlay
      el("div", { class: "relative z-10 flex-1 p-[32px] overflow-y-auto flex flex-col gap-6", id: "alert-detail" },
        renderAlertDetail(selectedAlertId ? alerts.find(a => a.id === selectedAlertId) : alerts[0])
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-alerts");
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
    if (state.context?.alerts) {
      renderAlertList(state.context.alerts);
    }
  });
}

function filterBtn(label, value, active, color) {
  return el("button", { 
    class: `px-4 py-2 rounded-full font-data text-data-mono transition-colors ${active 
      ? (color === "error" ? "bg-error text-on-error" : color === "tertiary" ? "bg-tertiary-container text-on-tertiary-container border border-tertiary/30" : color === "secondary" ? "bg-secondary-container text-on-secondary-container border border-secondary/30" : "bg-on-surface text-surface")
      : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant"} ${color === "error" && !active ? "text-error" : ""}`,
    onclick: () => setFilter(value)
  }, color !== "all" ? el("span", { class: `w-2 h-2 rounded-full ${color === "error" ? "bg-on-error" : color === "tertiary" ? "bg-tertiary" : "bg-secondary"}` }) : null, label);
}

function setFilter(severity) {
  filterSeverity = severity;
  const alerts = getState().context?.alerts || [];
  renderAlertList(alerts);
  
  // Update active button
  document.querySelectorAll("#alert-filters button").forEach(btn => {
    const isActive = btn.onclick.toString().includes(severity);
    if (isActive) {
      btn.classList.add("bg-error", "text-on-error");
      btn.classList.remove("bg-surface-container-high", "text-on-surface-variant");
    } else {
      btn.classList.remove("bg-error", "text-on-error");
      btn.classList.add("bg-surface-container-high", "text-on-surface-variant");
    }
  });
}

function filteredAlerts(alerts) {
  if (filterSeverity === "all") return alerts;
  return alerts.filter(a => a.severity?.toLowerCase() === filterSeverity);
}

function renderAlertList(alerts) {
  const list = document.getElementById("alert-list");
  if (!list) return;
  const filtered = filteredAlerts(alerts);
  list.innerHTML = "";
  filtered.forEach(alert => list.appendChild(alertCard(alert)));
}

function alertCard(alert) {
  const isActive = alert.id === selectedAlertId;
  const sevColors = {
    Critical: { bg: "bg-error-container/20", border: "border-2 border-error", icon: "text-error", text: "text-error" },
    High: { bg: "bg-surface", border: "border border-outline-variant/20", icon: "text-tertiary", text: "text-tertiary" },
    Moderate: { bg: "bg-surface", border: "border border-outline-variant/20", icon: "text-secondary", text: "text-secondary" }
  };
  const c = sevColors[alert.severity] || sevColors.Critical;

  return el("div", { 
    class: `alert-card p-[16px] rounded-xl ${c.bg} ${c.border} cursor-pointer transition-all hover:bg-surface-container-high ${isActive ? "ring-2 ring-primary" : ""}`, 
    onclick: () => selectAlert(alert.id)
  },
    el("div", { class: "absolute top-0 right-0 p-3 flex flex-col items-end" },
      el("span", { class: `font-data text-data-mono ${c.text} font-bold tracking-wider` }, alert.severity),
      el("span", { class: "text-[10px] font-data text-on-surface-variant opacity-70" }, alert.time || "Just now")
    ),
    el("div", { class: "flex items-start gap-4 mb-3" },
      el("div", { class: `w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.icon === "text-error" ? "bg-error/20 border border-error/50" : c.icon === "text-tertiary" ? "bg-tertiary-container/30 border border-tertiary/20" : "bg-surface-container-high"}`, style: `color: ${c.icon.replace("text-", "")}` },
        icon(alert.severity === "Critical" ? "warning" : alert.severity === "High" ? "thermostat" : "group", c.icon === "text-error" ? "text-[20px]" : "text-[20px]")
      ),
      el("div", {},
        el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface leading-none mb-1" }, alert.location || "Unknown Location"),
        el("p", { class: "font-body text-[14px] leading-[20px] text-on-surface-variant flex items-center gap-1" }, icon("location_on", "text-[16px]"), alert.region || "Unknown Region")
      )
    ),
    el("div", { class: "grid grid-cols-2 gap-4 mt-4", style: { opacity: isActive ? 1 : 0.7 } },
      el("div", { class: "bg-surface-container-high p-3 rounded-lg flex items-baseline justify-between border border-outline-variant/10" },
        el("span", { class: "text-[10px] font-data text-on-surface-variant uppercase" }, "Peak Temp"),
        el("span", { class: `font-data text-[20px] ${c.text} font-bold` }, alert.temp || "—")
      ),
      el("div", { class: "bg-surface-container-high p-3 rounded-lg flex items-baseline justify-between border border-outline-variant/10" },
        el("span", { class: "text-[10px] font-data text-on-surface-variant uppercase" }, "Duration"),
        el("span", { class: "font-data text-[20px] text-on-surface font-bold" }, alert.duration || "—")
      )
    )
  );
}

function selectAlert(id) {
  selectedAlertId = id;
  const alerts = getState().context?.alerts || [];
  const alert = alerts.find(a => a.id === id);
  
  // Update card styles
  document.querySelectorAll(".alert-card").forEach(card => {
    card.classList.remove("bg-error-container/20", "border-2", "border-error", "ring-2", "ring-primary");
    card.classList.add("bg-surface", "border", "border-outline-variant/20");
  });
  
  const selectedCard = document.querySelector(`.alert-card[onclick*="${id}"]`);
  if (selectedCard) {
    selectedCard.classList.remove("bg-surface", "border", "border-outline-variant/20");
    selectedCard.classList.add("bg-error-container/20", "border-2", "border-error", "ring-2", "ring-primary");
  }
  
  renderAlertDetail(alert);
}

function renderAlertDetail(alert) {
  const container = document.getElementById("alert-detail");
  if (!container || !alert) return;

  const sevColors = {
    Critical: { bg: "bg-error-container/90", border: "border-error/50", text: "text-on-error-container", icon: "text-error", pulse: "animate-pulse" },
    High: { bg: "bg-tertiary-container/90", border: "border-tertiary/50", text: "text-on-tertiary-container", icon: "text-tertiary" },
    Moderate: { bg: "bg-secondary-container/90", border: "border-secondary/50", text: "text-on-secondary-container", icon: "text-secondary" }
  };
  const c = sevColors[alert.severity] || sevColors.Critical;

  container.innerHTML = "";
  container.appendChild(
    el("div", { class: `${c.bg} backdrop-blur-md rounded-2xl p-6 ${c.border} shadow-2xl flex justify-between items-center` },
      el("div", {},
        el("div", { class: "flex items-center gap-3 mb-2" },
          el("span", { class: `px-2 py-1 bg-${alert.severity === "Critical" ? "error" : alert.severity === "High" ? "tertiary" : "secondary"} ${c.text} rounded font-data text-[10px] font-bold tracking-widest uppercase ${c.pulse || ""}` }, `${alert.severity} Alert`),
          el("span", { class: "font-data text-data-mono ${c.text}-on font-bold tracking-widest opacity-80 uppercase" }, `ID: ${alert.id}`)
        ),
        el("h2", { class: "font-display text-[40px] text-${c.text} leading-none" }, alert.title || "Alert")
      ),
      el("div", { class: "flex gap-4" },
        el("div", { class: "text-right" },
          el("div", { class: "text-[10px] font-data text-${c.text}/70 uppercase" }, "Current Temp"),
          el("div", { class: "font-data text-display-lg ${c.icon}" }, alert.temp || "—")
        ),
        el("div", { class: "w-px h-16 bg-${c.icon.replace('text-', '')}/30 mx-2" }),
        el("div", { class: "text-right" },
          el("div", { class: "text-[10px] font-data text-${c.text}/70 uppercase" }, "Estimated Impact"),
          el("div", { class: "font-headline text-${c.text}" }, alert.impact || "—")
        )
      )
    ),
    el("div", { class: "grid grid-cols-2 gap-6 flex-1" },
      // Left Column: Details
      el("div", { class: "flex flex-col gap-6" },
        el("div", { class: "bg-surface/80 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-6 shadow-lg" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 flex items-center gap-2" }, icon("analytics", "text-on-surface-variant"), "Impact Analysis"),
          el("div", { class: "space-y-4" },
            detailRow("Primary Risk", alert.primaryRisk || "Transformer Overheating"),
            detailRow("Vulnerable Facilities", alert.vulnerableFacilities || "3 Hospitals, 12 Schools"),
            detailRow("Cooling Centers Active", alert.coolingCenters || "14 / 20")
          )
        ),
        // Trend Chart
        el("div", { class: "bg-surface/80 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-6 shadow-lg flex-1 min-h-[200px] flex flex-col relative overflow-hidden" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-2 relative z-10" }, "Temperature Forecast"),
          el("div", { class: "absolute inset-x-0 bottom-0 h-32 opacity-20", style: "background: linear-gradient(0deg, var(--color-error) 0%, transparent 100%);" }),
          el("div", { class: "flex-1 w-full h-full flex items-end justify-between px-2 pb-2 relative z-10" },
            el("svg", { class: "w-full h-32 overflow-visible", preserveAspectRatio: "none", viewBox: "0 0 100 100" },
              el("polyline", { class: "text-error", fill: "none", points: "0,80 20,70 40,30 60,10 80,40 100,50", stroke: "currentColor", "stroke-width": "2" }),
              el("circle", { class: "text-error animate-ping", cx: "60", cy: "10", fill: "currentColor", r: "3" })
            )
          )
        )
      ),
      // Right Column: Actions & Log
      el("div", { class: "flex flex-col gap-6" },
        el("div", { class: "bg-surface/80 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-6 shadow-lg" },
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 flex items-center gap-2" }, icon("cloud_upload", "text-on-surface-variant"), "Recommended Actions"),
          el("div", { class: "space-y-3" },
            actionBtn("bolt", "Execute Load Shedding Protocol", "error", true),
            actionBtn("notifications_active", "Issue Public Heat Warning", "tertiary"),
            actionBtn("local_hospital", "Mobilize Emergency Services", "secondary")
          )
        ),
        // Event Log
        el("div", { class: "bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-6 shadow-lg flex-1" },
          el("h3", { class: "text-[10px] font-data text-outline uppercase tracking-widest mb-4" }, "Event Log"),
          el("div", { class: "space-y-4" },
            logEntry("08:14", "Temperature crossed critical threshold (48°C). Alert generated automatically."),
            logEntry("08:10", "Grid stress index indicated rapid increase in Zone D.", true),
            logEntry("07:45", "Pre-warning issued by environmental modeler.", true)
          )
        )
      )
    )
  );
}

function detailRow(label, value) {
  return el("div", { class: "flex justify-between items-center pb-2 border-b border-outline-variant/10" },
    el("span", { class: "text-on-surface-variant font-data text-data-mono uppercase" }, label),
    el("span", { class: "text-on-surface font-bold" }, value)
  );
}

function actionBtn(iconName, label, color, primary = false) {
  return el("button", { class: `w-full ${primary ? "bg-error text-on-error" : "bg-surface-container-high border border-outline-variant/20 text-on-surface"} py-4 px-6 rounded-xl font-bold flex justify-between items-center ${primary ? "hover:bg-error/90 transition-all shadow-md shadow-error/20" : "hover:bg-surface-container-highest transition-all"} group` },
    el("span", { class: "flex items-center gap-3" }, icon(iconName, color === "error" ? "text-on-error" : color === "tertiary" ? "text-tertiary" : "text-secondary"), label),
    icon("arrow_forward", "group-hover:translate-x-1 transition-transform")
  );
}

function logEntry(time, message, dim = false) {
  return el("div", { class: "flex gap-4" },
    el("div", { class: `font-data text-[12px] text-on-surface-variant shrink-0 w-16 ${dim ? "opacity-70" : ""}` }, time),
    el("div", { class: `text-[12px] text-on-surface ${dim ? "opacity-70" : ""}` }, message)
  );
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearGrid();
}
