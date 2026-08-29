// CoolRoute Screen (from ui/coolroute_optimizer/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { getRoutes, geoSearch, geoPlaces } from "../lib/api.js";
import { mount as mountMap, drawRoutes, clearRoutes, focusPlace } from "../lib/map.js";
import { el, icon, toast, tempF, mins, km } from "../lib/widgets.js";

let mapMounted = false;
let unsubscribe = null;
let selectedRouteId = null;
let originPlace = null;
let destPlace = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const main = el("main", { class: "relative w-full h-[calc(100vh-64px)] overflow-hidden" },
    // Map Background
    el("div", { id: "map-coolroute", class: "absolute inset-0 z-0 bg-surface-dim" }),
    el("div", { class: "absolute inset-0 z-0 bg-gradient-to-r from-surface/90 via-surface/40 to-transparent pointer-events-none" }),
    // Content Grid
    el("div", { class: "relative z-10 grid grid-cols-12 gap-[16px] p-[32px] h-full pointer-events-none" },
      // Left Panel: Routing & Inputs
      el("div", { class: "col-span-4 flex flex-col gap-6 pointer-events-auto h-full" },
        // Header
        el("div", { class: "flex flex-col gap-2" },
          el("div", { class: "flex items-center gap-2" }, el("span", { class: "font-data text-primary uppercase tracking-widest" }, "04 \u2014 CoolRoute")),
          el("h1", { class: "font-headline text-[32px] leading-[40px] text-on-surface" }, "Thermal Route Optimization"),
          el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant" }, "Find the route that works for you \u2014 not just the fastest one.")
        ),
        // Inputs
        el("div", { class: "bg-surface-container-lowest/80 backdrop-blur-xl p-4 rounded-xl shadow-xl flex flex-col gap-4" },
          routeInput("Origin", "my_location", originPlace?.display || "Central Station, Transit Hub A", async () => {
            const place = await searchPlace("Origin");
            if (place) { originPlace = place; updateInputs(); }
          }),
          routeInput("Destination", "location_on", destPlace?.display || "Sector 7G, Industrial Park", async () => {
            const place = await searchPlace("Destination");
            if (place) { destPlace = place; updateInputs(); }
          })
        ),
        // Route Options
        el("div", { class: "flex flex-col gap-4 overflow-y-auto pb-8 pr-2", id: "route-cards" },
          routeCard({ id: "fast", label: "Fastest", color: "error", icon: "warning", time: "14m", dist: "3.2 mi", temp: "112\u00b0F", exposure: "High Exposure", recommended: false, selectable: false }),
          routeCard({ id: "balanced", label: "Balanced", color: "tertiary", icon: "thermostat", time: "18m", dist: "3.8 mi", temp: "104\u00b0F", exposure: "Moderate", recommended: true, selectable: true }),
          routeCard({ id: "cool", label: "Coolest", color: "secondary", icon: "ac_unit", time: "26m", dist: "4.5 mi", temp: "98\u00b0F", exposure: "Low Exposure", recommended: false, selectable: true })
        )
      ),

      // Right Panel: Visual Comparison
      el("div", { class: "col-span-5 col-start-8 flex flex-col justify-end pb-8 pointer-events-auto h-full" },
        el("div", { class: "bg-surface-container-lowest/85 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl flex flex-col gap-6" },
          el("div", { class: "flex justify-between items-end" },
            el("div", { class: "flex flex-col" },
              el("h2", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, "Heat Exposure vs. Time"),
              el("p", { class: "font-data text-[12px] uppercase tracking-wide mt-1 text-on-surface-variant" }, "Fastest \u2260 Always Best")
            ),
            el("div", { class: "flex gap-4" },
              legendDot("error", "FAST"),
              legendDot("tertiary", "BALANCED"),
              legendDot("secondary", "COOL")
            )
          ),
          el("div", { class: "w-full h-48 relative", id: "route-chart" })
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize map
  setTimeout(() => {
    const mapContainer = document.getElementById("map-coolroute");
    if (mapContainer && !mapMounted) {
      mountMap(mapContainer, { center: [33.4484, -112.074], zoom: 10 });
      mapMounted = true;
    }
    renderChart();
  }, 100);

  unsubscribe = subscribe((state) => {
    if (state.routes) {
      updateRouteCards(state.routes);
    }
  });

  // Trigger initial route analysis
  runRouteAnalysis();
}

function routeInput(label, iconName, value, onSearch) {
  return el("div", { class: "flex flex-col gap-1" },
    el("label", { class: "font-data text-[10px] uppercase font-bold text-on-surface-variant" }, label),
    el("div", { class: "bg-surface-container-high py-3 px-4 rounded-lg shadow-inner flex items-center gap-3 transition-colors hover:bg-surface-container-highest group cursor-pointer", onclick: onSearch },
      icon(iconName, "text-on-surface-variant group-hover:text-primary transition-colors text-[20px]"),
      el("input", { class: "bg-transparent border-none outline-none font-body text-on-surface w-full placeholder:text-outline", readonly: true, type: "text", value })
    )
  );
}

function routeCard({ id, label, color, icon: iconName, time, dist, temp, exposure, recommended, selectable }) {
  const colorMap = { error: "bg-red-500", tertiary: "bg-amber-500", secondary: "bg-gray-400" };
  const bgColor = colorMap[color] || colorMap.error;
  
  return el("div", { 
    class: `bg-surface-container/90 backdrop-blur-md rounded-xl p-4 flex gap-4 cursor-pointer ${selectable ? "hover:bg-surface-container-high transition-transform hover:-translate-y-1 shadow-md" : ""} ${recommended ? "bg-surface-container-high/95 backdrop-blur-xl rounded-xl p-4 flex gap-4 cursor-pointer transition-transform hover:-translate-y-1 shadow-[0_0_40px_-10px_rgba(200,198,197,0.2)] relative overflow-hidden" : ""}`,
    onclick: selectable ? () => selectRoute(id) : undefined
  },
    el("div", { class: `w-1.5 rounded-full ${bgColor} flex-shrink-0` }),
    el("div", { class: "flex-1 flex flex-col gap-3" },
      el("div", { class: "flex justify-between items-start" },
        el("div", {},
          el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface" }, label),
          el("div", { class: `font-data ${recommended ? "text-amber-500" : "text-red-500"} flex items-center gap-1 mt-1` }, icon(iconName, "text-[16px]"), exposure)
        ),
        el("div", { class: "text-right" },
          el("div", { class: "font-display text-[32px] font-bold text-on-surface leading-none" }, time, el("span", { class: "text-body font-normal text-on-surface-variant" }, "m")),
          el("div", { class: "font-data text-on-surface-variant" }, dist)
        )
      ),
      el("div", { class: "flex justify-between items-end" },
        el("div", { class: "flex flex-col" },
          el("span", { class: "font-data text-[10px] text-outline uppercase" }, "Peak Temp"),
          el("span", { class: "font-data text-on-surface" }, temp)
        ),
        selectable ? el("button", {
          class: `px-4 py-2 rounded-full font-data font-bold shadow-lg transition-colors ${recommended ? "bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"}`
        }, recommended ? "Deploy Route" : "Select") : null
      )
    ),
    recommended ? el("div", { class: "absolute top-0 right-0 bg-primary text-on-primary font-data text-[10px] font-bold uppercase px-3 py-1 rounded-bl-lg" }, "Recommended") : null
  );
}

function legendDot(color, label) {
  const colorMap = { error: "bg-red-500", tertiary: "bg-amber-500", secondary: "bg-gray-400" };
  return el("div", { class: "flex items-center gap-2" }, el("div", { class: `w-3 h-3 rounded-full ${colorMap[color]}` }), el("span", { class: "font-data text-[10px] text-on-surface" }, label));
}

function selectRoute(id) {
  selectedRouteId = id;
  document.querySelectorAll("#route-cards > div").forEach(card => {
    card.classList.toggle("ring-2", card.onclick?.toString().includes(id));
    card.classList.toggle("ring-primary", card.onclick?.toString().includes(id));
  });
}

function renderChart() {
  const container = document.getElementById("route-chart");
  if (!container) return;
  
  // Simple canvas-based chart
  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.innerHTML = "";
  container.appendChild(canvas);
  
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const cw = w - padding.left - padding.right;
  const ch = h - padding.top - padding.bottom;
  
  // Grid
  ctx.strokeStyle = "#444748";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
  
  // Routes data
  const routes = [
    { id: "fast", color: "#ffb4ab", points: [[0, 0.9], [0.3, 0.8], [0.5, 0.1], [0.7, 0.1], [1, 0.9]] },
    { id: "balanced", color: "#ffb59d", points: [[0, 0.9], [0.3, 0.85], [0.5, 0.4], [0.7, 0.4], [1, 0.9]] },
    { id: "cool", color: "#c5c7c8", points: [[0, 0.9], [0.4, 0.88], [0.75, 0.7], [1, 0.9]] }
  ];
  
  routes.forEach(r => {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.id === "balanced" ? 4 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (r.id === "cool") ctx.setLineDash([4, 4]);
    ctx.beginPath();
    r.points.forEach(([x, y], i) => {
      const px = padding.left + x * cw;
      const py = padding.top + y * ch;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
  
  // Highlight dots
  routes.forEach(r => {
    const last = r.points[r.points.length - 1];
    const px = padding.left + last[0] * cw;
    const py = padding.top + last[1] * ch;
    ctx.fillStyle = "#0c141f";
    ctx.beginPath();
    ctx.arc(px, py, r.id === "balanced" ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.id === "balanced" ? 3 : 2;
    ctx.stroke();
  });
  
  // Axis labels
  ctx.fillStyle = "#c4c7c7";
  ctx.font = "10px Geist, monospace";
  ctx.textAlign = "center";
  ["0m", "10m", "20m", "30m"].forEach((l, i) => {
    ctx.fillText(l, padding.left + (i / 3) * cw, h - padding.bottom + 20);
  });
  ctx.textAlign = "right";
  ["120\u00b0", "100\u00b0", "80\u00b0"].forEach((l, i) => {
    ctx.fillText(l, padding.left - 10, padding.top + (i / 2) * ch + 4);
  });
}

async function runRouteAnalysis() {
  if (!originPlace || !destPlace) {
    // Use default places
    const places = await geoPlaces();
    originPlace = places.results?.find(p => p.id === "miami-downtown") || places.results?.[0];
    destPlace = places.results?.find(p => p.id === "miami-brickell") || places.results?.[1];
    updateInputs();
  }
  
  if (!originPlace || !destPlace) return;
  
  toast("Analyzing routes...", "info");
  try {
    const res = await getRoutes({ fromId: originPlace.id, toId: destPlace.id, mode: "driving" });
    setState({ routes: res });
    updateRouteCards(res);
    
    // Draw routes on map
    setTimeout(() => {
      if (res.routes) {
        drawRoutes(res.routes, res.routes[0]?.id);
      }
    }, 200);
    
    toast("Route analysis complete", "success");
  } catch (err) {
    toast(err.message || "Route analysis failed", "error");
  }
}

function updateInputs() {
  const originEl = document.querySelector("#route-cards").previousElementSibling?.querySelector("input");
  const destEl = document.querySelector("#route-cards").previousElementSibling?.querySelectorAll("input")[1];
  if (originEl) originEl.value = originPlace?.display || "Origin";
  if (destEl) destEl.value = destPlace?.display || "Destination";
}

function updateRouteCards(res) {
  if (!res?.routes) return;
  
  const container = document.getElementById("route-cards");
  if (!container) return;
  
  const routeMap = { fast: "Fastest", balanced: "Balanced", cool: "Coolest" };
  
  container.innerHTML = "";
  res.routes.forEach((r, i) => {
    const key = r.id.replace("demo-route-", "").replace("route-", "");
    const label = routeMap[key] || r.label || r.id;
    const isBalanced = label === "Balanced";
    const isCoolest = label === "Coolest";
    
    const exposure = r.exposure;
    const tempF = exposure?.meanF ? `${Math.round(exposure.meanF)}\u00b0F` : "\u2014";
    const exposureLabel = exposure?.band === "Extreme" ? "High Exposure" : exposure?.band === "Hot" ? "High Exposure" : exposure?.band === "Warm" ? "Moderate" : "Low Exposure";
    
    container.appendChild(routeCard({
      id: r.id,
      label,
      color: isBalanced ? "tertiary" : isCoolest ? "secondary" : "error",
      icon: isBalanced ? "thermostat" : isCoolest ? "ac_unit" : "warning",
      time: `${Math.round(r.durationSeconds / 60)}m`,
      dist: `${(r.distanceMeters / 1000).toFixed(1)} mi`,
      temp: tempF,
      exposure: exposureLabel,
      recommended: isBalanced,
      selectable: true
    }));
  });
  
  renderChart();
}

async function searchPlace(type) {
  // Simple search - in real implementation would open search modal
  const places = await geoPlaces();
  return places.results?.[0];
}

export function unmount() {
  if (unsubscribe) unsubscribe();
  clearRoutes();
}
