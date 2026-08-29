// Platform Settings Screen (from ui/platform_settings/code.html)

import { getState, setState } from "../lib/store.js";
import { getHealth, getFortyGuardStatus } from "../lib/api.js";
import { initTheme, applyTheme } from "../lib/theme.js";
import { el, icon, toast } from "../lib/widgets.js";

let unsubscribe = null;
let activeSection = "appearance";

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const main = el("main", { class: "flex flex-col h-full" },
    el("div", { class: "flex items-center justify-between mb-8 p-[32px] pt-[32px] pb-8" },
      el("div", {},
        el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface mb-2" }, "Platform Settings"),
        el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-2xl" }, "Manage configuration, units, and system health for the Command Center.")
      ),
      el("div", { class: "flex gap-4" },
        el("button", { class: "px-6 py-3 bg-surface-container-highest text-on-surface hover:bg-surface-variant font-headline text-headline rounded-lg transition-colors shadow-sm", onclick: () => toast("Changes discarded", "info") }, "Discard"),
        el("button", { class: "px-6 py-3 bg-primary text-on-primary hover:bg-primary-fixed font-headline text-headline rounded-lg transition-colors shadow-md", onclick: saveSettings }, "Save Changes")
      )
    ),
    el("div", { class: "grid grid-cols-1 xl:grid-cols-12 gap-[16px] relative flex-1 p-[32px] pb-[32px]", id: "settings-content" },
      // Sidebar Navigation
      el("div", { class: "xl:col-span-3 space-y-2 sticky top-0 self-start pb-8", id: "settings-sidebar" },
        settingsNavBtn("palette", "Appearance", true),
        settingsNavBtn("straighten", "Units & Measures", false),
        settingsNavBtn("map", "Map Defaults", false),
        settingsNavBtn("dataset", "Data Stream", false),
        settingsNavBtn("monitor_heart", "System Health", false)
      ),
      // Content Panels
      el("div", { class: "xl:col-span-9 space-y-[32px] pb-32", id: "settings-panels" },
        // Appearance Section
        el("section", { class: "bg-surface-container-low rounded-xl shadow-lg p-[32px] space-y-8", id: "appearance" },
          el("div", { class: "border-b border-surface-container-highest pb-4" },
            el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-3" }, icon("palette", "text-primary"), "Appearance"),
            el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant mt-2" }, "Customize the visual theme of the command interface.")
          ),
          el("div", { class: "grid grid-cols-1 md:grid-cols-3 gap-[16px]" },
            themeOption("Light", true, true),
            themeOption("Dark", false, false),
            themeOption("System", false, false)
          )
        ),
        // Units Section
        el("section", { class: "bg-surface-container-low rounded-xl shadow-lg p-[32px] space-y-6 relative overflow-hidden", id: "units" },
          el("div", { class: "absolute -right-24 -top-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" }),
          el("div", { class: "border-b border-surface-container-highest pb-4" },
            el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-3" }, icon("straighten", "text-primary"), "Units & Measures")
          ),
          el("div", { class: "space-y-6" },
            unitSetting("Temperature Unit", "Standard unit for thermal intelligence.", "Celsius (\u00b0C)", "Fahrenheit (\u00b0F)", "tempUnit"),
            unitSetting("Distance & Area", "Used for spatial mapping and risk zones.", "Metric (km/ha)", "Imperial (mi/ac)", "distanceUnit")
          )
        ),
        // Map Defaults Section
        el("section", { class: "bg-surface-container-low rounded-xl shadow-lg p-[32px] space-y-6", id: "map" },
          el("div", { class: "border-b border-surface-container-highest pb-4" },
            el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-3" }, icon("map", "text-primary"), "Map Defaults")
          ),
          el("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-6" },
            mapTileOption("Dark Mono", "High-contrast baseline for heat layers.", "https://lh3.googleusercontent.com/aida-public/AB6AXuAXWw61lddAjBs4keobJMVxOCJAOuEZupjNKl75aoqG_Tm0njtYNqrBJc-gTGBhgJ7FPaqSMdGf6ad_50FGcfgGqyilh5NzhVPxkQxOk38urFHE7KxsxC2a7WjgCGxCtGyGe_oPVPIaaOG4ogFvujR5WSaa-9wTATlTCrcif_8dDj4KVaYIQGeM3_yz265hABBkZVmL7hxsoApcYtkdV12RHozpV4BsUpnkclPeRijoOCQsf4yF2hhGZw", true, "DEFAULT TILE"),
            mapTileOption("Satellite Hybrid", "Photorealistic baseline with road overlays.", "https://lh3.googleusercontent.com/aida-public/AB6AXuDTCXTWbTXJQd-Y1y_5La1ek2nXEmLjd6wfbsC8a2vszMFGzsa9Od_CBfcKJsIFsKSy2MXJFyF_iIQT-8vdFb7R2VpyaKzhVVCNoIeO-IxL7XHrdWsIBuLDxhhJbxtXnYaKiPntCG8iWjHkiECEriLAx-0udZPMQXoOQQpt3uzhlHqcNpleeFX-uXguIig9kJyqNEiRpRgi_mNdRCxYmbvsxa5fFqY012kBYI6xc4S7uIhUEiNxOuDXfA", false, "ALTERNATE TILE")
          ),
          el("div", { class: "flex items-center justify-between p-4 bg-surface rounded-lg shadow-sm mt-4" },
            el("div", {},
              el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-1" }, "Auto-center on active alerts"),
              el("p", { class: "font-body text-[14px] text-on-surface-variant" }, "Map will pan to critical heat events automatically.")
            ),
            el("label", { class: "relative inline-flex items-center cursor-pointer" },
              el("input", { type: "checkbox", checked: true, class: "sr-only peer" }),
              el("div", { class: "w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" })
            )
          )
        ),
        // System Section
        el("section", { class: "bg-surface-container-low rounded-xl shadow-lg p-[32px] space-y-6", id: "system" },
          el("div", { class: "border-b border-surface-container-highest pb-4 flex justify-between items-end" },
            el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface flex items-center gap-3" }, icon("monitor_heart", "text-primary"), "System Status"),
            el("span", { class: "flex items-center gap-2 text-emerald-400 font-data text-data-mono" }, el("span", { class: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "ALL SYSTEMS NOMINAL")
          ),
          el("div", { class: "bg-surface rounded-lg p-6 shadow-sm overflow-hidden" },
            el("div", { class: "grid grid-cols-2 md:grid-cols-4 gap-6" },
              sysInfo("Version", "v2.4.1-stable"),
              sysInfo("Latency", "24ms"),
              sysInfo("Last Sync", "2 min ago"),
              sysInfo("Environment", "PRODUCTION", "text-primary")
            ),
            el("div", { class: "mt-8 pt-6 border-t border-surface-container-highest flex justify-between items-center" },
              el("p", { class: "font-body text-[14px] text-on-surface-variant max-w-lg" }, "For support or critical system failures, contact the Command Center Operations team."),
              el("button", { class: "px-4 py-2 bg-surface-container border border-outline/20 text-on-surface hover:bg-surface-variant font-headline text-headline rounded-md transition-colors shadow-sm flex items-center gap-2", onclick: () => toast("Exporting logs...", "info") }, icon("download", "text-[18px]"), "Export Logs")
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize
  unsubscribe = subscribe((state) => {
    // Update system health if needed
  });

  // Load initial system health
  loadSystemHealth();
}

function settingsNavBtn(iconName, label, active) {
  return el("button", { class: `w-full text-left px-4 py-3 rounded-lg ${active ? "bg-surface-container-high text-on-surface font-headline text-headline shadow-sm transition-all group border-l-4 border-primary" : "hover:bg-surface-container text-on-surface-variant font-headline text-headline transition-all group border-l-4 border-transparent hover:border-outline"}`, onclick: () => switchSection(label.toLowerCase().replace(" & ", "-").replace(" ", "-")) },
    el("div", { class: "flex items-center gap-3" },
      icon(iconName, `text-[20px] ${active ? "text-primary" : "opacity-70 group-hover:opacity-100"}`),
      label
    )
  );
}

function switchSection(section) {
  activeSection = section;
  document.querySelectorAll("#settings-sidebar button").forEach(btn => {
    const isActive = btn.textContent.includes(section.charAt(0).toUpperCase() + section.slice(1));
    btn.classList.toggle("bg-surface-container-high", isActive);
    btn.classList.toggle("text-on-surface", isActive);
    btn.classList.toggle("font-semibold", isActive);
    btn.classList.toggle("shadow-inner", isActive);
    btn.classList.toggle("border-primary", isActive);
    btn.classList.toggle("text-on-surface-variant", !isActive);
    btn.classList.toggle("hover:bg-surface-container", !isActive);
    btn.querySelector(".material-symbols-outlined").classList.toggle("opacity-70", !isActive);
    btn.querySelector(".material-symbols-outlined").classList.toggle("group-hover:opacity-100", !isActive);
  });
  
  document.querySelectorAll("#settings-panels > section").forEach(sec => {
    sec.style.display = sec.id === section ? "block" : "none";
  });
}

function themeOption(label, isLight, selected) {
  const lightColors = { bg: "#f3f4f6", sidebar: "#ffffff", header: "#ffffff", accent: "#3b82f6" };
  const darkColors = { bg: "#111827", sidebar: "#1f2937", header: "#1f2937", accent: "#3b82f6" };
  const systemColors = { bg1: "#f3f4f6", sidebar1: "#ffffff", bg2: "#111827", sidebar2: "#1f2937", header2: "#1f2937", accent: "#3b82f6" };

  let previewHTML = "";
  if (isLight) {
    previewHTML = `<div class="w-full h-full bg-[#f3f4f6] relative"><div class="absolute top-0 left-0 w-8 h-full bg-white border-r border-gray-200"></div><div class="absolute top-0 left-8 right-0 h-6 bg-white border-b border-gray-200"></div><div class="absolute top-10 left-12 w-16 h-8 bg-blue-100 rounded-sm"></div></div>`;
  } else if (label === "Dark") {
    previewHTML = `<div class="w-full h-full bg-[#111827] relative"><div class="absolute top-0 left-0 w-8 h-full bg-gray-800 border-r border-gray-700"></div><div class="absolute top-0 left-8 right-0 h-6 bg-gray-800 border-b border-gray-700"></div><div class="absolute top-10 left-12 w-16 h-8 bg-blue-900 rounded-sm"></div></div>`;
  } else {
    previewHTML = `<div class="w-1/2 h-full bg-[#f3f4f6] relative border-r border-gray-400"><div class="absolute top-0 left-0 w-4 h-full bg-white border-r border-gray-200"></div></div><div class="w-1/2 h-full bg-[#111827] relative"><div class="absolute top-0 left-4 right-0 h-6 bg-gray-800 border-b border-gray-700"></div></div>`;
  }

  return el("button", { class: `relative bg-surface rounded-lg p-1 transition-all ${selected ? "ring-2 ring-primary" : "hover:bg-surface-container-high ring-1 ring-surface-container-highest hover:ring-outline"}`, onclick: () => setTheme(label.toLowerCase()) },
    el("div", { class: "rounded-md h-32 w-full flex items-center justify-center mb-4 overflow-hidden border border-outline/20" }, previewHTML),
    el("div", { class: "flex items-center justify-between px-2 pb-2" },
      el("span", { class: `font-headline text-headline ${selected ? "text-on-surface" : "text-on-surface-variant"}` }, label),
      selected ? icon("check_circle", "text-primary", true) : null
    )
  );
}

function unitSetting(label, desc, primary, secondary, key) {
  return el("div", { class: "flex items-center justify-between p-4 bg-surface rounded-lg shadow-sm" },
    el("div", {},
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-1" }, label),
      el("p", { class: "font-body text-[14px] text-on-surface-variant" }, desc)
    ),
    el("div", { class: "flex bg-surface-container p-1 rounded-lg" },
      el("button", { class: `px-4 py-2 ${key === "tempUnit" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"} font-headline text-headline rounded-md ${key === "tempUnit" ? "shadow-sm" : "transition-colors"}`, onclick: () => setUnit(key, primary) }, primary),
      el("button", { class: `px-4 py-2 ${key === "tempUnit" ? "text-on-surface-variant hover:text-on-surface" : "bg-primary text-on-primary"} font-headline text-headline rounded-md ${key === "tempUnit" ? "transition-colors" : "shadow-sm"}`, onclick: () => setUnit(key, secondary) }, secondary)
    )
  );
}

function mapTileOption(title, desc, imgUrl, selected, badge) {
  return el("div", { class: `bg-surface p-4 rounded-lg shadow-sm flex flex-col justify-between h-48 group cursor-pointer relative overflow-hidden ${selected ? "ring-2 ring-primary" : "ring-1 ring-surface-container-highest hover:ring-outline"}` },
    el("div", { class: "absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-50 transition-opacity", style: `background-image: url('${imgUrl}')` }),
    el("div", { class: "relative z-10 flex justify-between items-start w-full" },
      badge ? el("span", { class: `px-2 py-1 ${selected ? "bg-primary/20 text-primary" : "bg-surface/80 text-on-surface-variant"} font-data text-data-mono rounded backdrop-blur-md` }, badge) : null,
      selected ? icon("check_circle", "text-primary", true) : null
    ),
    el("div", { class: "relative z-10" },
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-white" }, title),
      el("p", { class: "font-body text-[14px] text-gray-400" }, desc)
    )
  );
}

function sysInfo(label, value, valueClass = "") {
  return el("div", { class: "space-y-1" },
    el("p", { class: "font-data text-[10px] uppercase tracking-widest text-on-surface-variant" }, label),
    el("p", { class: `font-headline text-[24px] leading-[32px] text-on-surface ${valueClass}` }, value)
  );
}

function setTheme(theme) {
  const themes = { light: "light", dark: "dark", system: "system" };
  const t = themes[theme] || "system";
  applyTheme(t);
  localStorage.setItem("therma.theme", t);
  toast(`Theme set to ${t}`, "success");
  
  // Update UI
  document.querySelectorAll("#appearance button").forEach(btn => {
    const isSelected = btn.textContent.toLowerCase().includes(theme);
    btn.classList.toggle("ring-2", isSelected);
    btn.classList.toggle("ring-primary", isSelected);
    btn.querySelector(".material-symbols-outlined")?.classList.toggle("hidden", !isSelected);
  });
}

function setUnit(key, value) {
  localStorage.setItem(`therma.unit.${key}`, value);
  toast(`${key === "tempUnit" ? "Temperature" : "Distance"} set to ${value}`, "success");
  
  // Update button states
  document.querySelectorAll(`#${key} button`).forEach(btn => {
    btn.classList.toggle("bg-primary", btn.textContent.includes(value));
    btn.classList.toggle("text-on-primary", btn.textContent.includes(value));
    btn.classList.toggle("shadow-sm", btn.textContent.includes(value));
  });
}

async function loadSystemHealth() {
  try {
    const health = await getHealth();
    const fg = await getFortyGuardStatus();
    // Update system section with real data
  } catch (err) {
    console.error("Failed to load system health:", err);
  }
}

function saveSettings() {
  toast("Settings saved", "success");
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}
