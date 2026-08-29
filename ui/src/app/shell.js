// Application shell - sidebar, topbar, mobile nav, screen transitions

import { getState, setState, subscribe } from "../lib/store.js";
import { navigate, current, ROUTES } from "../lib/router.js";
import { el, icon } from "../lib/widgets.js";

const NAV_GROUPS = {
  command: [
    { key: "overview", label: "Overview", icon: "dashboard" },
    { key: "heat", label: "Heat Intelligence", icon: "thermostat" },
    { key: "coolroute", label: "CoolRoute", icon: "route" },
    { key: "explorer", label: "Map Explorer", icon: "explore" }
  ],
  intel: [
    { key: "environment", label: "Environmental Intelligence", icon: "air" },
    { key: "portfolio", label: "Portfolio Monitoring", icon: "domain" },
    { key: "urban", label: "Urban & Property Intelligence", icon: "location_city" },
    { key: "facilities", label: "Facility Analysis", icon: "precision_manufacturing" }
  ],
  ops: [
    { key: "logistics", label: "Logistics Operations", icon: "local_shipping" },
    { key: "utilities", label: "Infrastructure & Utilities", icon: "bolt" }
  ],
  analysis: [
    { key: "risk", label: "Risk & Insurance", icon: "warning" },
    { key: "scenarios", label: "Scenario Simulation", icon: "tune" },
    { key: "alerts", label: "Active Alerts", icon: "notifications_active" },
    { key: "reports", label: "Reports Library", icon: "summarize" },
    { key: "workspace", label: "Decision Workspace", icon: "space_dashboard" },
    { key: "zoe", label: "Zoe Operator Workspace", icon: "psychology" }
  ]
};

const FOOTER_NAV = [
  { key: "search", label: "Global Search", icon: "search" },
  { key: "location", label: "Location Detail", icon: "location_on" },
  { key: "settings", label: "Settings", icon: "settings" },
  { key: "intelligence", label: "THERMA Intelligence", icon: "insights" }
];

function buildNavItem({ key, label, icon: iconName }, isActive) {
  return el("a", {
    href: `#/${key}`,
    "data-path": key,
    class: `flex items-center px-[16px] py-2 group transition-all ${isActive 
      ? "bg-secondary-container text-on-secondary-container font-semibold shadow-inner" 
      : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"}`
  },
    el("span", { class: "material-symbols-outlined mr-3 text-[20px] opacity-70 group-hover:opacity-100" }, iconName),
    label
  );
}

function updateActiveNav() {
  const route = current();
  const activeKey = route?.name || "overview";
  
  document.querySelectorAll("#sidebar a[data-path]").forEach(a => {
    const isActive = a.dataset.path === activeKey;
    a.classList.toggle("bg-secondary-container", isActive);
    a.classList.toggle("text-on-secondary-container", isActive);
    a.classList.toggle("font-semibold", isActive);
    a.classList.toggle("shadow-inner", isActive);
    a.classList.toggle("text-on-surface-variant", !isActive);
    a.classList.toggle("hover:bg-surface-container-highest", !isActive);
    a.classList.toggle("hover:text-on-surface", !isActive);
    a.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function initSidebar() {
  // Build navigation sections
  for (const [section, items] of Object.entries(NAV_GROUPS)) {
    const container = document.getElementById(`sidebar-nav-${section}`);
    if (!container) continue;
    items.forEach(item => {
      container.appendChild(buildNavItem(item, false));
    });
  }
  
  // Footer nav
  const footerContainer = document.querySelector("#sidebar .mt-auto");
  if (footerContainer) {
    // Remove the collapse button temporarily
    const collapseBtn = document.getElementById("sidebar-collapse-btn");
    FOOTER_NAV.forEach(item => {
      const btn = buildNavItem(item, false);
      footerContainer.insertBefore(btn, collapseBtn);
    });
  }
  
  // Collapse button
  const collapseBtn = document.getElementById("sidebar-collapse-btn");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", toggleSidebar);
  }
  
  // Update active state on route change
  window.addEventListener("hashchange", updateActiveNav);
  updateActiveNav();
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const collapsed = sidebar.dataset.collapsed === "true";
  sidebar.dataset.collapsed = String(!collapsed);
  setState({ sidebarCollapsed: !collapsed });
  
  const label = collapseBtn.querySelector(".collapse-label");
  const iconEl = collapseBtn.querySelector(".material-symbols-outlined");
  if (!collapsed) {
    sidebar.style.width = "72px";
    if (label) label.style.display = "none";
    if (iconEl) iconEl.textContent = "chevron_right";
  } else {
    sidebar.style.width = "400px";
    if (label) label.style.display = "inline";
    if (iconEl) iconEl.textContent = "open_in_full";
  }
  
  // Trigger map resize
  setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
}

function initMobileNav() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const drawer = document.getElementById("sidebar");
  const scrim = document.getElementById("drawer-scrim");
  
  function openDrawer() {
    drawer.classList.add("visible");
    scrim.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  
  function closeDrawer() {
    drawer.classList.remove("visible");
    scrim.classList.add("hidden");
    document.body.style.overflow = "";
  }
  
  menuBtn?.addEventListener("click", openDrawer);
  scrim?.addEventListener("click", closeDrawer);
  drawer?.querySelectorAll("a[data-path]").forEach(a => {
    a.addEventListener("click", closeDrawer);
  });
  
  // Expose for Zoe
  window.__THERMA_DRAWER = { open: openDrawer, close: closeDrawer };
}

function initMobileBottomNav() {
  const container = document.getElementById("mobile-bottomnav");
  if (!container) return;
  
  const primary = ["overview", "heat", "coolroute", "explorer"];
  
  primary.forEach(key => {
    const route = ROUTES[key];
    if (!route) return;
    const btn = el("button", {
      class: `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors active:bg-surface-container ${current()?.name === key ? "text-primary" : "text-on-surface-variant"}`,
      onclick: () => navigate(key)
    },
      el("span", { class: "material-symbols-outlined text-[24px]" }, NAV_GROUPS.command.find(i => i.key === key)?.icon || NAV_GROUPS.intel.find(i => i.key === key)?.icon || NAV_GROUPS.ops.find(i => i.key === key)?.icon || NAV_GROUPS.analysis.find(i => i.key === key)?.icon || "circle"),
      el("span", { class: "font-data text-[10px]" }, route.title.split(" ")[0])
    );
    container.appendChild(btn);
  });
  
  // Update on route change
  window.addEventListener("hashchange", () => {
    const active = current()?.name;
    container.querySelectorAll("button").forEach(btn => {
      const key = btn.onclick.toString().match(/navigate\("(\w+)"\)/)?.[1];
      btn.classList.toggle("text-primary", key === active);
      btn.classList.toggle("text-on-surface-variant", key !== active);
    });
  });
}

export function initShell() {
  initSidebar();
  initMobileNav();
  initMobileBottomNav();
  
  // Screen transition handling
  const screen = document.getElementById("screen");
  let currentScreenEl = null;
  
  const originalResolve = window.__THERMA_ROUTE_RESOLVE;
  window.__THERMA_ROUTE_RESOLVE = (route, host) => {
    if (currentScreenEl) {
      currentScreenEl.classList.add("screen-exit", "screen-exit-active");
      setTimeout(() => {
        if (currentScreenEl.parentNode === host) host.removeChild(currentScreenEl);
      }, 200);
    }
    
    // Import and mount new screen
    import(`../screens/${ROUTES[route.name].screen}.js`).then(module => {
      if (module.mount) {
        host.innerHTML = "";
        const newScreen = el("div", { class: "screen-enter flex-1" });
        host.appendChild(newScreen);
        currentScreenEl = newScreen;
        // Force reflow
        newScreen.offsetHeight;
        newScreen.classList.add("screen-enter-active");
        module.mount(newScreen, route);
      }
    }).catch(err => {
      console.error(`Failed to load screen:`, err);
      host.innerHTML = `<div class="p-8 text-center text-error">Failed to load screen</div>`;
    });
  };
}

export { navigate, current };
