// Logistics Operations Screen (from ui/logistics_operations/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { getRoutes, loadContextFor } from "../lib/api.js";
import { mount as mountMap, drawRoutes, clearRoutes, focusPlace } from "../lib/map.js";
import { el, icon, toast, tempF, mins, km } from "../lib/widgets.js";

let unsubscribe = null;
let mapMounted = false;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "relative w-full h-[calc(100vh-64px)]" },
    // Map Layer (Full Bleed Background)
    el("div", { class: "absolute inset-0 z-0 opacity-80", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiQ4j74-Rzn6jPDcL8j9nxKqgWFWW6xKuTDFqgc5V47rXQJu8GGDS79tZvNwWgLjMc9Hy3XU8n29Gyh4KJe1G3-45lSQq3UhsEZtf5VdLl0SLA3UuJyTsWswshmW4dsTJC-c8_ikBXPpBlai68jq9RB3B6Rmev8ZPlt0CCT4GMXqNgO1FMCSWrUU72xfVREHYGaZGI4Vu0SOGSQQ9knsvI_YCE7nc4kmYL8GIaHvkh6SJ9mNmnQPTv9g')" }),
    // Map Gradient Scrims for Readability
    el("div", { class: "absolute inset-0 z-0 bg-gradient-to-r from-background via-background/40 to-transparent w-1/2 pointer-events-none" }),
    el("div", { class: "absolute top-0 right-0 bottom-0 w-1/3 bg-gradient-to-l from-background/90 to-transparent pointer-events-none z-0" }),
    // Interactive Map Interface Grid Layer
    el("div", { class: "relative z-10 w-full h-[calc(100vh-64px)] grid grid-cols-12 gap-[16px] px-[32px] py-[32px]" },
      // Left Hand Analytical Panel
      el("div", { class: "col-span-12 md:col-span-4 lg:col-span-3 flex flex-col gap-[16px] h-full" },
        // Panel Header: Route Intel
        el("div", { class: "bg-surface-container-low/90 backdrop-blur-xl p-[16px] rounded-xl shadow-lg border border-outline-variant/10 flex flex-col gap-4" },
          el("div", {},
            el("h2", { class: "font-data text-[10px] uppercase tracking-widest text-outline mb-1" }, "Route Intelligence"),
            el("div", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "LAX-PHX Corridor"),
            el("div", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant flex items-center gap-2 mt-1" }, icon("local_shipping", "text-[16px]"), "Heavy Freight")
          ),
          el("div", { class: "grid grid-cols-2 gap-4" },
            el("div", { class: "flex flex-col" }, el("span", { class: "font-data text-[10px] uppercase text-outline" }, "Distance"), el("span", { class: "font-body text-[18px] leading-[28px] text-on-surface font-semibold" }, "372 mi")),
            el("div", { class: "flex flex-col" }, el("span", { class: "font-data text-[10px] uppercase text-outline" }, "Est. Duration"), el("span", { class: "font-body text-[18px] leading-[28px] text-on-surface font-semibold" }, "5h 45m"))
          )
        ),
        // Fleet Exposure Summary
        el("div", { class: "bg-surface-container-low/90 backdrop-blur-xl p-[16px] rounded-xl shadow-lg border border-outline-variant/10 flex-1 flex flex-col min-h-0" },
          el("div", { class: "flex justify-between items-center mb-4 shrink-0" },
            el("h3", { class: "font-data text-[10px] uppercase tracking-widest text-outline" }, "Fleet Exposure"),
            el("span", { class: "px-2 py-1 bg-error-container text-on-error-container font-data text-[10px] rounded uppercase font-bold" }, "Critical Risk")
          ),
          el("div", { class: "flex-1 overflow-y-auto space-y-4 pr-2" },
            el("div", { class: "flex items-center justify-between p-3 bg-surface-container-high rounded-lg group hover:bg-surface-container-highest transition-colors cursor-pointer" },
              el("div", { class: "flex items-center gap-3" },
                el("div", { class: "w-8 h-8 rounded-full bg-error/20 flex items-center justify-center text-error border border-error/30" }, icon("thermostat", "text-[18px]")),
                el("div", {},
                  el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface font-semibold" }, "Peak Temp Expectation"),
                  el("div", { class: "font-data text-error" }, "114°F @ 14:00")
                )
              )
            ),
            el("div", { class: "flex flex-col gap-2 p-3 bg-surface-container-high rounded-lg" },
              el("div", { class: "flex justify-between items-end" },
                el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface" }, "Assets in High-Risk Zone"),
                el("div", { class: "font-data text-on-surface font-bold" }, "12 / 48 Units")
              ),
              el("div", { class: "w-full h-1.5 bg-surface rounded-full overflow-hidden flex" },
                el("div", { class: "w-1/4 bg-error h-full" }),
                el("div", { class: "w-1/4 bg-tertiary h-full" }),
                el("div", { class: "w-2/4 bg-primary-fixed-dim h-full" })
              ),
              el("div", { class: "flex justify-between text-[10px] font-data uppercase text-outline mt-1" },
                el("span", {}, "Critical"),
                el("span", {}, "Warning"),
                el("span", {}, "Safe")
              )
            ),
            el("div", { class: "flex flex-col gap-3 mt-4" },
              el("h4", { class: "font-data text-[10px] uppercase text-outline" }, "Active Alerts"),
              el("div", { class: "pl-3 border-l-2 border-error py-1" },
                el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface font-medium" }, "Tire Blowout Risk High"),
                el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface-variant text-sm" }, "I-10 corridor surface temps exceeding 140°F.")
              ),
              el("div", { class: "pl-3 border-l-2 border-tertiary py-1" },
                el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface font-medium" }, "Cab Cooling Degradation"),
                el("div", { class: "font-body text-[14px] leading-[20px] text-on-surface-variant text-sm" }, "Units 402, 405 reporting A/C stress.")
              )
            )
          )
        )
      ),

      // Center/Right Floating Operational Panel
      el("div", { class: "col-span-12 md:col-span-8 lg:col-span-4 lg:col-start-9 flex flex-col justify-end h-full pointer-events-none pb-[32px]" },
        el("div", { class: "pointer-events-auto bg-surface-container-high/95 backdrop-blur-2xl p-6 rounded-2xl shadow-2xl border border-outline-variant/20 flex flex-col gap-6" },
          el("div", { class: "flex justify-between items-start" },
            el("h2", { class: "font-headline text-[24px] leading-[32px] text-on-surface leading-tight" }, "Operating<br/>Windows"),
            el("div", { class: "w-10 h-10 rounded-full bg-surface flex items-center justify-center text-primary cursor-pointer hover:bg-surface-container-highest transition-colors" }, icon("tune"))
          ),
          // Timeline visualization
          el("div", { class: "relative w-full h-24 bg-surface rounded-lg p-3 overflow-hidden flex flex-col justify-between" },
            el("div", { class: "flex justify-between text-[10px] font-data text-outline z-10 uppercase" },
              el("span", {}, "00:00"),
              el("span", {}, "06:00"),
              el("span", {}, "12:00"),
              el("span", {}, "18:00"),
              el("span", {}, "23:59")
            ),
            el("div", { class: "relative w-full h-4 bg-surface-container-lowest rounded-full mt-2 z-10" },
              // Safe Window
              el("div", { class: "absolute left-0 w-[30%] h-full bg-primary-fixed-dim/40 rounded-l-full border-b-2 border-primary" }),
              // High Risk Window
              el("div", { class: "absolute left-[30%] w-[40%] h-full bg-error/20 border-b-2 border-error" },
                el("div", { class: "absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDRMMCAwbDQtNEwwIDB6IiBmaWxsPSIjZmZiNGFiIiBmaWxsLW9wYWNpdHk9IjAuNSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-50" })
              ),
              // Safe Window
              el("div", { class: "absolute left-[70%] w-[30%] h-full bg-primary-fixed-dim/40 rounded-r-full border-b-2 border-primary" }),
              // Current Time Marker
              el("div", { class: "absolute left-[55%] top-1/2 -translate-y-1/2 w-1 h-6 bg-on-surface shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 rounded-full flex flex-col items-center justify-start" },
                el("div", { class: "absolute -top-6 text-[10px] font-data font-bold bg-on-surface text-surface px-1 py-0.5 rounded" }, "13:15")
              )
            )
          ),
          el("div", { class: "text-[10px] font-data text-outline text-center mt-3 tracking-wider" }, "TIMELINE: TODAY"),
          // Decision Centric Buttons
          el("div", { class: "flex flex-col gap-3 mt-2" },
            el("button", { class: "w-full bg-error text-on-error py-3 px-4 rounded-lg font-body text-body font-bold flex items-center justify-between hover:brightness-110 transition-all shadow-[0_4px_20px_-5px_rgba(255,180,171,0.5)]", onclick: () => toast("Halting non-critical freight", "info") },
              el("span", { class: "flex items-center gap-2" }, icon("warning"), "Halt Non-Critical Freight"),
              el("span", { class: "font-data text-[12px] opacity-80 uppercase" }, "Est. Delay 4h")
            ),
            el("button", { class: "w-full bg-tertiary-container text-on-tertiary-container py-3 px-4 rounded-lg font-body text-body font-bold flex items-center justify-between hover:bg-tertiary-container/80 transition-all border border-tertiary/20", onclick: () => toast("Deploying cool alternative route", "info") },
              el("span", { class: "flex items-center gap-2" }, icon("alt_route"), "Deploy Cool Alternative"),
              el("span", { class: "font-data text-[12px] opacity-80 uppercase" }, "+45m / -12°F")
            ),
            el("button", { class: "w-full bg-surface-container hover:bg-surface-container-highest text-on-surface py-3 px-4 rounded-lg font-body text-body font-bold flex items-center justify-center transition-all border border-outline-variant/30", onclick: () => toast("Shifting to night operations", "info") },
              el("span", { class: "flex items-center gap-2" }, icon("schedule"), "Shift to Night Operations")
            )
          )
        )
      )
    ),
    // Floating Map Controls (Bottom Center-ish)
    el("div", { class: "fixed bottom-[32px] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface/80 backdrop-blur-md p-1.5 rounded-full border border-outline-variant/20 shadow-xl z-20" },
      el("button", { class: "w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors", title: "Toggle Fleet Overlay" }, icon("directions_bus", "text-[20px]")),
      el("div", { class: "w-px h-6 bg-outline-variant/30 mx-1" }),
      el("button", { class: "w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors", title: "Toggle Heat Overlay" }, icon("layers", "text-[20px]")),
      el("button", { class: "w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors", title: "Zoom In" }, icon("add", "text-[20px]")),
      el("button", { class: "w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors", title: "Zoom Out" }, icon("remove", "text-[20px]"))
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.querySelector("main > div.absolute.inset-0.z-0.opacity-80");
    if (mapContainer && !mapMounted) {
      // Mount map on a dedicated container
      const mapDiv = el("div", { id: "map-logistics", class: "absolute inset-0" });
      mapContainer.parentNode.insertBefore(mapDiv, mapContainer.nextSibling);
      const map = mountMap(mapDiv, { center: [34.0522, -118.2437], zoom: 6 });
      mapMounted = true;
    }
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.routes) {
      // Update route display
    }
  });
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearRoutes();
}
