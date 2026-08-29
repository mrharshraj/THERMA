// Reports Library Screen (from ui/reports_library/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, generateReport, reportUrl, stashedReports } from "../lib/api.js";
import { el, icon, toast, timeAgo } from "../lib/widgets.js";

let unsubscribe = null;
let currentFilter = "ALL REPORTS";
let selectedReport = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const reports = stashedReports();

  const main = el("main", { class: "flex flex-col h-full" },
    el("div", { class: "flex items-end justify-between w-full p-[32px] pt-[32px] pb-8" },
      el("div", { class: "flex flex-col space-y-2" },
        el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface" }, "Reports"),
        el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-2xl" }, "Access, generate, and distribute intelligence reports across your operational footprint.")
      ),
      el("div", { class: "flex gap-3" },
        el("button", { class: "px-6 py-3 rounded-full bg-surface-container-high text-on-surface font-data text-data-mono hover:bg-surface-container-highest transition-colors flex items-center gap-2 shadow-sm" }, icon("filter_list", "text-[20px]"), "FILTER"),
        el("button", { class: "px-6 py-3 rounded-full bg-primary text-on-primary font-data text-data-mono hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-md", onclick: generateNewReport }, icon("add", "text-[20px]"), "GENERATE REPORT")
      )
    ),
    el("div", { class: "flex gap-4 pb-4 overflow-x-auto w-full no-scrollbar px-[32px]", id: "filter-tabs" },
      ["ALL REPORTS", "HEAT ANALYSIS", "ASSET RISK", "ROUTE ANALYSIS", "EXECUTIVE BRIEFING"].map(f => filterTab(f))
    ),
    el("div", { class: "grid grid-cols-12 gap-[16px] w-full min-h-[600px] px-[32px] pb-[32px] flex-1", id: "reports-grid" },
      // Report List
      el("div", { class: "col-span-8 flex flex-col space-y-4", id: "reports-list" },
        renderReportList(reports)
      ),
      // Report Detail Panel
      el("div", { class: "col-span-4 flex flex-col", id: "report-detail" },
        el("div", { class: "sticky top-24 bg-surface-container-low rounded-2xl p-6 flex flex-col h-[calc(100vh-8rem)] overflow-y-auto shadow-lg" },
          selectedReport ? renderReportDetail(selectedReport) : emptyDetail()
        )
      )
    )
  );

  host.appendChild(main);

  unsubscribe = subscribe((state) => {
    if (state.context && !selectedReport) {
      // Could auto-generate report on context change
    }
  });
}

function filterTab(label) {
  return el("button", { 
    class: `shrink-0 px-6 py-3 rounded-full font-data text-data-mono flex items-center gap-2 transition-all shadow-sm ${currentFilter === label 
      ? "bg-secondary-container text-on-secondary-container" 
      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"}`,
    onclick: () => setFilter(label)
  },
    el("span", { class: "material-symbols-outlined text-[18px]" }, filterIcon(label)),
    label
  );
}

function filterIcon(label) {
  const icons = { "ALL REPORTS": "all_inclusive", "HEAT ANALYSIS": "thermostat", "ASSET RISK": "domain", "ROUTE ANALYSIS": "route", "EXECUTIVE BRIEFING": "summarize" };
  return icons[label] || "description";
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll("#filter-tabs button").forEach(btn => {
    const isActive = btn.textContent.includes(filter);
    btn.className = `shrink-0 px-6 py-3 rounded-full font-data text-data-mono flex items-center gap-2 transition-all shadow-sm ${isActive 
      ? "bg-secondary-container text-on-secondary-container" 
      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"}`;
  });
}

function renderReportList(reports) {
  const container = document.getElementById("reports-list");
  if (!container) return;

  // Add demo reports if empty
  const demoReports = [
    { id: "R-20231024-001", title: "Q3 Urban Heat Island Assessment", type: "Heat Analysis", location: "Phoenix, AZ", status: "Ready", time: "Oct 24, 09:00", icon: "thermostat", iconBg: "tertiary-container", iconColor: "on-tertiary-container", desc: "Comprehensive analysis of surface temperature differentials across 14 commercial districts, identifying critical intervention zones for incoming heatwave event." },
    { id: "R-20231022-002", title: "Data Center Alpha - Thermal Integrity", type: "Asset Risk", location: "Frankfurt, DE", status: "Draft", time: "Oct 22, 14:30", icon: "domain", iconBg: "error-container", iconColor: "on-error-container", desc: "Evaluation of HVAC load balancing during sustained 35°C+ ambient temperatures. Preliminary findings suggest minor throttling required in Sector 4." },
    { id: "R-20231017-003", title: "Weekly Executive Summary - EMEA", type: "Executive Briefing", location: "Global", status: "Archived", time: "Oct 17, 17:00", icon: "summarize", iconBg: "secondary-container", iconColor: "on-secondary-container", desc: "Weekly executive briefing covering thermal risk across EMEA portfolio with strategic recommendations." },
    { id: "R-20231015-004", title: "Cold Chain Logistics Route Alpha-9", type: "Route Analysis", location: "Tokyo, JP", status: "Archived", time: "Oct 15, 08:15", icon: "route", iconBg: "primary-container", iconColor: "on-primary-container", desc: "Thermal route analysis for cold chain logistics between Tokyo and Osaka. Identified 3 critical thermal corridors requiring intervention." }
  ];

  const allReports = [...reports.map(r => ({ ...r.meta, ...r, icon: "description", iconBg: "surface-container", iconColor: "on-surface" })), ...demoReports];

  container.innerHTML = "";
  ["THIS WEEK", "LAST WEEK"].forEach((section, si) => {
    const sectionReports = si === 0 ? allReports.slice(0, 2) : allReports.slice(2);
    container.appendChild(el("div", { class: "text-[10px] font-bold uppercase tracking-widest text-outline font-data px-4" }, section));
    sectionReports.forEach((report, i) => {
      const isSelected = selectedReport?.id === report.id;
      container.appendChild(reportCard(report, isSelected, si === 0 && i === 0));
    });
  });
}

function reportCard(report, isSelected, autoSelect) {
  const statusColors = {
    Ready: { bg: "bg-surface-container-highest", text: "text-on-surface" },
    Draft: { bg: "bg-surface-container-highest", text: "text-on-surface" },
    Archived: { bg: "bg-surface-container-highest", text: "text-on-surface" }
  };
  const sc = statusColors[report.status] || statusColors.Ready;

  if (autoSelect && !selectedReport) {
    setTimeout(() => selectReport(report), 0);
  }

  return el("div", { class: `group relative bg-surface-container flex flex-col rounded-xl overflow-hidden hover:bg-surface-container-high transition-colors cursor-pointer shadow-sm ${isSelected ? "ring-2 ring-primary" : ""}`, onclick: () => selectReport(report) },
    el("div", { class: "p-6 flex flex-col gap-4" },
      el("div", { class: "flex justify-between items-start" },
        el("div", { class: "flex items-center gap-3" },
          el("div", { class: `w-10 h-10 rounded-full ${report.iconBg} flex items-center justify-center` },
            icon(report.icon, `text-[20px] ${report.iconColor}`, true)
          ),
          el("div", {},
            el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface group-hover:text-tertiary transition-colors" }, report.title),
            el("p", { class: "font-data text-[12px] text-on-surface-variant uppercase mt-1" }, report.type, " \u2022 ", report.location)
          )
        ),
        el("div", { class: "flex flex-col items-end gap-1" },
          el("span", { class: `px-3 py-1 rounded-full ${sc.bg} ${sc.text} font-data text-[10px] uppercase tracking-wider` }, report.status),
          el("span", { class: "font-data text-[12px] text-on-surface-variant" }, report.time)
        )
      ),
      el("p", { class: "font-body text-[14px] leading-[20px] text-on-surface-variant line-clamp-2" }, report.desc)
    )
  );
}

function selectReport(report) {
  const el = document.getElementById("report-detail");
  if (!el) return;
  selectedReport = report;
  el.innerHTML = "";
  el.appendChild(renderReportDetail(report));
  
  // Update card selection
  document.querySelectorAll("#reports-list > div").forEach(card => {
    card.classList.toggle("ring-2", card.onclick?.toString().includes(report.id));
    card.classList.toggle("ring-primary", card.onclick?.toString().includes(report.id));
  });
}

function renderReportDetail(report) {
  return el("div", { class: "flex flex-col" },
    el("div", { class: "flex justify-between items-start mb-6" },
      el("div", { class: "flex flex-col" },
        el("span", { class: "font-data text-[10px] uppercase tracking-widest text-tertiary mb-2" }, report.type),
        el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface leading-tight" }, report.title)
      ),
      el("button", { class: "w-10 h-10 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors" }, icon("more_vert"))
    ),
    el("div", { class: "w-full aspect-video rounded-xl overflow-hidden mb-6 relative" },
      el("div", { class: "w-full h-full bg-cover bg-center", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFh4IJew5lawZd7SiS7f0NCHUSWMwGXoc7QUMawwk2UgxWIdkU7lGUxVAtoQ42c3Ho3m-8qiKXfYt8e1rhBh92a6U40DIRW1SsU7egAefqj701HQ-gsYLqN4VkdHl78M4C6lK9TjkvoavyDjXOoYGykgRTTI02YUlMWpUYILLCXxuc69lfkireyhJsHfwyb4qTmreZLk5O-ah-8nqmJXIkRqHXtpNMQWSgDVENoKIEIByTlmQX6iuD0A')" }),
      el("div", { class: "absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-transparent to-transparent" }),
      el("div", { class: "absolute bottom-3 left-3 flex items-center gap-2" }, icon("location_on", "text-[16px] text-on-surface"), el("span", { class: "font-data text-[12px] text-on-surface drop-shadow-md" }, report.location))
    ),
    el("div", { class: "grid grid-cols-2 gap-4 mb-6" },
      detailItem("Generated", report.time),
      detailItem("Author", report.author || "System AI"),
      detailItem("Pages", report.pages || "24"),
      detailItem("Size", report.size || "4.2 MB")
    ),
    el("div", { class: "flex flex-col gap-2 mb-8" },
      el("span", { class: "font-data text-[10px] text-outline uppercase mb-1" }, "Key Findings Extract"),
      el("p", { class: "font-body text-[14px] leading-relaxed text-sm text-on-surface-variant bg-surface-container p-4 rounded-lg" }, report.desc)
    ),
    el("div", { class: "mt-auto flex flex-col gap-3" },
      el("button", { class: "w-full py-4 rounded-full bg-primary text-on-primary font-headline text-sm hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 shadow-md", onclick: () => viewReport() }, icon("visibility", "text-[20px]"), "VIEW REPORT"),
      el("div", { class: "flex gap-3" },
        el("button", { class: "flex-1 py-3 rounded-full bg-surface-container-highest text-on-surface font-data text-xs hover:bg-surface-variant transition-colors flex items-center justify-center gap-2" }, icon("download", "text-[18px]"), "DOWNLOAD"),
        el("button", { class: "flex-1 py-3 rounded-full bg-surface-container-highest text-on-surface font-data text-xs hover:bg-surface-variant transition-colors flex items-center justify-center gap-2" }, icon("share", "text-[18px]"), "SHARE")
      )
    )
  );
}

function emptyDetail() {
  return el("div", { class: "flex flex-col items-center justify-center h-full text-center" },
    icon("description", "text-[64px] text-on-surface-variant"),
    el("h2", { class: "font-headline text-[24px] mt-4 text-on-surface" }, "Select a Report"),
    el("p", { class: "font-body text-on-surface-variant mt-2" }, "Choose a report from the list to view details")
  );
}

function detailItem(label, value) {
  return el("div", { class: "flex flex-col p-4 bg-surface-container rounded-lg" },
    el("span", { class: "font-data text-[10px] text-outline uppercase mb-1" }, label),
    el("span", { class: "font-body text-on-surface" }, value)
  );
}

async function generateNewReport() {
  const st = getState();
  if (!st.context) return toast("No context loaded", "error");
  toast("Generating report...", "info");
  try {
    const rep = await generateReport(JSON.parse(JSON.stringify(st.context)));
    toast("Report generated", "success");
    // Refresh list would happen via subscription
  } catch (err) {
    toast(err.message || "Generation failed", "error");
  }
}

function viewReport() {
  if (selectedReport?.id) {
    window.open(`/api/reports/${selectedReport.id}`, "_blank", "noopener");
  }
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}
