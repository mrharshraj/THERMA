// Global Command Search Screen (from ui/global_command_search/code.html)

import { getState, setState } from "../lib/store.js";
import { geoSearch } from "../lib/api.js";
import { navigate, ROUTES, current } from "../lib/router.js";
import { el, icon } from "../lib/widgets.js";

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "bg-surface font-body h-full";

  const main = el("main", { class: "fixed inset-0 bg-background/80 backdrop-blur-2xl z-50 flex items-start justify-center pt-[153px] px-[16px] md:px-0" },
    el("div", { class: "w-full max-w-2xl bg-surface-container-low rounded-xl shadow-2xl shadow-primary/10 overflow-hidden flex flex-col transform transition-all scale-100 opacity-100", id: "command-palette" },
      // Search Header
      el("div", { class: "relative flex items-center px-6 py-4 bg-surface-container border-b border-outline-variant/10" },
        icon("search", "text-primary text-[28px] mr-4"),
        el("input", { autocomplete: "off", autofocus: true, class: "w-full bg-transparent text-headline text-headline text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none", id: "command-input", placeholder: "Search commands, locations, screens...", spellcheck: "false", type: "text" }),
        el("div", { class: "flex items-center gap-2 ml-4" },
          el("kbd", { class: "px-2 py-1 rounded bg-surface-container-highest text-[10px] font-data text-on-surface-variant uppercase tracking-widest shadow-inner shadow-outline/5" }, "ESC")
        )
      ),
      // Search Content Area
      el("div", { class: "flex-1 overflow-y-auto max-h-[614px]", id: "command-results" },
        // Quick Actions / Suggestions
        el("div", { class: "p-4 bg-surface-container-highest/30" },
          el("div", { class: "flex items-center gap-2 mb-3 px-2" },
            icon("bolt", "text-[16px] text-tertiary"),
            el("span", { class: "text-[10px] font-data font-bold uppercase tracking-widest text-on-surface-variant" }, "Suggested Actions")
          ),
          el("div", { class: "grid grid-cols-2 gap-2" },
            suggestedAction("assessment", "Generate Report", "Global Portfolio Overview", "primary"),
            suggestedAction("warning", "Critical Alerts", "3 Active Anomalies", "error")
          )
        ),
        // Recent Searches
        el("div", { class: "py-4" },
          el("div", { class: "px-6 mb-2" },
            el("span", { class: "text-[10px] font-data font-bold uppercase tracking-widest text-outline" }, "Recent Activity")
          ),
          el("ul", { class: "space-y-1 px-2", id: "recent-list" },
            recentItem("location_city", "Miami Downtown", "Location", "High Heat Vulnerability Zone", "secondary-container", "on-secondary-container"),
            recentItem("thermostat", "Heat Intelligence", "Screen", "Global Heatmap & Predictive Analytics", "tertiary-container", "on-tertiary-container"),
            recentItem("terminal", "Deploy Cooling Assets", "Command", "Target: Sector 7G", "primary-container", "on-primary-container")
          )
        )
      ),
      // Footer
      el("div", { class: "px-6 py-3 bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant/10" },
        el("div", { class: "flex items-center gap-4" },
          el("div", { class: "flex items-center gap-1" },
            icon("keyboard_arrow_up", "text-[14px] text-outline"),
            icon("keyboard_arrow_down", "text-[14px] text-outline"),
            el("span", { class: "text-[10px] font-data text-on-surface-variant ml-1" }, "Navigate")
          ),
          el("div", { class: "flex items-center gap-1" },
            el("kbd", { class: "px-1.5 rounded bg-surface-container text-[10px] font-data text-on-surface-variant shadow-inner shadow-outline/5" }, "\u23ce"),
            el("span", { class: "text-[10px] font-data text-on-surface-variant ml-1" }, "Select")
          )
        ),
        el("div", { class: "text-[10px] font-data text-outline flex items-center gap-1" },
          el("span", { class: "w-2 h-2 rounded-full bg-primary animate-pulse" }),
          "SYSTEM ONLINE"
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize search
  const input = document.getElementById("command-input");
  const items = document.querySelectorAll(".command-item");
  let selectedIndex = -1;

  if (input) {
    input.focus();

    function updateSelection() {
      items.forEach((item, index) => {
        if (index === selectedIndex) {
          item.classList.add("bg-surface-container-highest", "ring-1", "ring-primary");
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.classList.remove("bg-surface-container-highest", "ring-1", "ring-primary");
        }
      });
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelection();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const selectedItem = items[selectedIndex];
          const itemName = selectedItem.querySelector(".text-body-lg").innerText;
          console.log(`Executing: ${itemName}`);
          selectedItem.classList.add("bg-primary/20");
          setTimeout(() => selectedItem.classList.remove("bg-primary/20"), 200);
        }
      } else if (e.key === "Escape") {
        input.blur();
        console.log("Closing Command Search");
      }
    });

    items.forEach((item, index) => {
      item.addEventListener("mouseenter", () => {
        selectedIndex = index;
        updateSelection();
      });
    });
  }
}

function suggestedAction(iconName, title, desc, color) {
  return el("button", { class: "flex items-center gap-3 p-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-left group" },
    el("div", { class: `w-8 h-8 rounded-full bg-${color}/10 flex items-center justify-center group-hover:bg-${color}/20 transition-colors` },
      icon(iconName, `text-[18px] text-${color}`)
    ),
    el("div", {},
      el("div", { class: "text-body text-body text-on-surface" }, title),
      el("div", { class: "text-data text-[10px] text-on-surface-variant" }, desc)
    )
  );
}

function recentItem(iconName, title, type, desc, iconBg, iconColor) {
  return el("li", {},
    el("button", { class: "w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-highest group transition-colors text-left command-item" },
      el("div", { class: "flex items-center gap-4" },
        el("div", { class: `w-10 h-10 rounded ${iconBg} flex items-center justify-center shrink-0` },
          icon(iconName, `text-[20px] ${iconColor}`)
        ),
        el("div", {},
          el("div", { class: "flex items-baseline gap-2" },
            el("span", { class: "text-body text-body text-on-surface group-hover:text-primary transition-colors" }, title),
            el("span", { class: "text-[10px] font-data text-outline bg-surface-container-low px-1.5 py-0.5 rounded" }, type)
          ),
          el("div", { class: "text-data text-[12px] text-on-surface-variant mt-0.5" }, desc)
        )
      ),
      el("div", { class: "opacity-0 group-hover:opacity-100 transition-opacity" },
        icon("arrow_forward", "text-on-surface-variant")
      )
    )
  );
}

export function unmount() {}
