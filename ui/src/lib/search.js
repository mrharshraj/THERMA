// Global search (ported from public/app/core.js search modal)

import { getState, setState } from "./store.js";
import { geoSearch } from "./api.js";
import { navigate, ROUTES, current } from "./router.js";
import { el, icon } from "./widgets.js";

let searchTimer = null;

function bindSearch() {
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  if (!modal || !input || !results) return;

  const openModal = () => {
    modal.classList.remove("hidden");
    input.value = "";
    renderSearchDefault(results);
    setTimeout(() => input.focus(), 60);
    setState({ searchOpen: true });
  };
  
  const closeModal = () => {
    modal.classList.add("hidden");
    setState({ searchOpen: false });
  };

  document.querySelectorAll("[data-search-close]").forEach(x => x.addEventListener("click", closeModal));
  document.getElementById("mobile-search-btn")?.addEventListener("click", openModal);
  
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      modal.classList.contains("hidden") ? openModal() : closeModal();
    }
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) { renderSearchDefault(results); return; }
    searchTimer = setTimeout(async () => {
      results.innerHTML = "";
      results.appendChild(el("div", { class: "p-[8px] flex items-center gap-[8px] text-on-surface-variant" },
        el("div", { class: "spinner" }), el("span", { class: "font-semibold text-[12px]" }, "Searching Florida locations\u2026")));
      try {
        const { results: locs } = await geoSearch(q);
        results.innerHTML = "";
        const screens = Object.entries(ROUTES).filter(([k, r]) =>
          r.title.toLowerCase().includes(q.toLowerCase()) || r.screen.toLowerCase().includes(q.toLowerCase()));
        if (screens.length) {
          results.appendChild(el("p", { class: "text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1" }, "Screens"));
          for (const [key, r] of screens.slice(0, 5)) {
            results.appendChild(searchRow(icon(r.icon, "text-[18px]"), r.title, "Navigate",
              () => { closeModal(); navigate(key); }));
          }
        }
        results.appendChild(el("p", { class: "text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1" }, "Locations"));
        if (!locs.length) {
          results.appendChild(el("p", { class: "px-3 py-3 text-[12.5px] text-on-surface-variant/80" },
            `No Florida location matched \u201c${q}\u201d.`));
        }
        for (const p of locs) {
          results.appendChild(searchRow(
            icon(p.external ? "travel_explore" : "location_on", "text-[18px]"),
            p.display,
            `${Number(p.lat).toFixed(3)}, ${Number(p.lon).toFixed(3)}${p.type ? " \u00b7 " + p.type : ""}`,
            async () => {
              closeModal();
              const { loadContextFor } = await import("./api.js");
              try {
                await loadContextFor(p.id);
                navigate("location", { param: p.id });
                import("./widgets.js").then(({ toast }) => toast(`Location set: ${p.display}`, "success"));
              } catch (err) {
                import("./widgets.js").then(({ toast }) => toast(err.message || "Could not load that location.", "error"));
              }
            }));
        }
      } catch {
        results.innerHTML = "";
        results.appendChild(el("p", { class: "px-3 py-3 text-[12.5px] text-error" }, "Search is unavailable right now."));
      }
    }, 280);
  });
}

function searchRow(icNode, title, sub, onClick) {
  return el("button", {
    class: "w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-container/80 text-left transition-colors",
    onclick
  },
    el("span", { class: "w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0" }, icNode),
    el("span", { class: "min-w-0 flex-1" },
      el("span", { class: "block text-[13.5px] font-bold truncate" }, title),
      sub ? el("span", { class: "block text-[11px] text-on-surface-variant/80 truncate" }, sub) : null),
    icon("north_east", "text-[14px] opacity-50")
  );
}

function renderSearchDefault(host) {
  host.innerHTML = "";
  host.appendChild(el("p", { class: "text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60 px-2 pt-2 pb-1" }, "Quick navigation"));
  ["overview", "heat", "coolroute", "environment", "alerts", "workspace"].forEach(k => {
    const r = ROUTES[k];
    host.appendChild(searchRow(icon(r.icon, "text-[18px]"), r.title, null, () => {
      document.getElementById("search-modal").classList.add("hidden");
      navigate(k);
    }));
  });
  host.appendChild(el("p", { class: "px-2 pt-3 pb-2 text-[11px] text-on-surface-variant/70" },
    "Type to search Miami-Dade and Florida locations \u2014 or press Esc to close."));
}

export function initSearch() {
  bindSearch();
}
