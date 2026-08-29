// Environmental Intelligence Screen (from ui/environmental_intelligence/code.html)

import { getState, subscribe, setState } from "../lib/store.js";
import { loadContextFor, loadEnvironmentFor } from "../lib/api.js";
import { el, icon, toast, tempF } from "../lib/widgets.js";

let unsubscribe = null;

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const st = getState();
  const ctx = st.context;
  const env = ctx?.environment;
  const current = env?.current;
  const place = ctx?.location || st.place;

  const main = el("main", { class: "flex flex-col h-full p-[32px] gap-[16px]" },
    // Header
    el("div", { class: "flex flex-col gap-[4px]" },
      el("div", { class: "text-[10px] font-data-mono uppercase tracking-[0.2em] text-primary" }, "06 \u2014 Intelligence"),
      el("div", { class: "text-display-lg font-display-lg text-on-surface" }, "Environmental Conditions")
    ),

    // Main Grid
    el("div", { class: "grid grid-cols-12 gap-[16px] flex-1" },
      // Location Context
      el("div", { class: "col-span-12 xl:col-span-4 relative overflow-hidden rounded-xl bg-surface-container shadow-lg h-64 flex flex-col justify-end p-[16px]" },
        el("div", { class: "absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity", style: "background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFh4IJew5lawZd7SiS7f0NCHUSWMwGXoc7QUMawwk2UgxWIdkU7lGUxVAtoQ42c3Ho3m-8qiKXfYt8e1rhBh92a6U40DIRW1SsU7egAefqj701HQ-gsYLqN4VkdHl78M4C6lK9TjkvoavyDjXOoYGykgRTTI02YUlMWpUYILLCXxuc69lfkireyhJsHfwyb4qTmreZLk5O-ah-8nqmJXIkRqHXtpNMQWSgDVENoKIEIByTlmQX6iuD0A')" }),
        el("div", { class: "absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/50 to-transparent" }),
        el("div", { class: "relative z-10" },
          el("div", { class: "text-headline-md font-headline-md text-on-surface flex items-center gap-2" },
            icon("location_on", "text-[20px] text-tertiary"),
            el("span", { id: "location-name" }, place?.display || "Select Location")
          ),
          el("div", { class: "text-data-mono font-data-mono text-on-surface-variant text-[12px] mt-1", id: "location-coords" }, place ? `${place.lat.toFixed(4)}\u00b0 N, ${Math.abs(place.lon).toFixed(4)}\u00b0 ${place.lon < 0 ? "W" : "E"} \u2022 ELEV \u2014` : "\u2014"),
          el("div", { class: "mt-4 flex gap-4" },
            el("div", { class: "bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-data-mono uppercase tracking-wider text-on-surface-variant" }, "Live Feed Active"),
            el("div", { class: "bg-error/20 px-3 py-1 rounded-full text-[10px] font-data-mono uppercase tracking-wider text-error animate-pulse", id: "location-risk-badge" }, current?.heatIndexC > 40 ? "Critical Zone" : "Monitored")
          )
        )
      ),

      // Risk Interpretation
      el("div", { class: "col-span-12 xl:col-span-8 bg-surface-container rounded-xl shadow-lg p-[32px] flex flex-col justify-center" },
        el("div", { class: "flex items-center justify-between mb-8" },
          el("div", { class: "text-headline-md font-headline-md text-on-surface" }, "Aggregate Risk Index"),
          el("div", { class: "text-[10px] font-data-mono tracking-widest uppercase text-on-surface-variant" }, "Real-time Assessment")
        ),
        el("div", { class: "relative h-12 w-full bg-surface-container-highest rounded-full overflow-hidden shadow-inner" },
          el("div", { class: "absolute inset-0 flex" },
            el("div", { class: "flex-1 bg-primary/10" }),
            el("div", { class: "flex-1 bg-secondary/20" }),
            el("div", { class: "flex-1 bg-tertiary/30" }),
            el("div", { class: "flex-1 bg-amber-500/50" }),
            el("div", { class: "flex-1 bg-error/70" })
          ),
          el("div", { class: "absolute top-0 bottom-0 w-2 bg-on-surface shadow-[0_0_15px_rgba(255,255,255,1)] z-10 transition-all duration-1000 ease-in-out", id: "risk-indicator", style: "left: 85%" })
        ),
        el("div", { class: "flex justify-between mt-3 text-[10px] font-data-mono uppercase text-on-surface-variant tracking-wider" },
          el("span", {}, "Safe"),
          el("span", {}, "Watch"),
          el("span", {}, "Elevated"),
          el("span", {}, "High"),
          el("span", { class: "text-error font-bold" }, "Critical")
        )
      ),

      // KPI Cards Grid
      el("div", { class: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-[16px]" },
        kpiCard("Ambient Temp", "device_thermostat", "error", current?.temperatureC ? `${current.temperatureC.toFixed(1)}\u00b0C` : "\u2014", "error", "M0 15 Q20 5, 40 10 T80 5 T100 2"),
        kpiCard("Heat Index", "local_fire_department", "amber", current?.heatIndexC ? `${current.heatIndexC.toFixed(1)}\u00b0C` : "\u2014", "amber", "M0 18 L20 12 L40 15 L60 8 L80 10 L100 0"),
        kpiCard("Humidity", "water_drop", "primary", current?.humidity ? `${Math.round(current.humidity)}%` : "\u2014", "primary", "M0 10 Q25 20, 50 10 T100 10"),
        kpiCard("Air Quality Index", "air", "tertiary", current?.aqi ? aqiValue(current.aqi) : "\u2014", "tertiary", "M0 20 L30 15 L50 18 L70 5 L100 8"),
        kpiCard("Wind Speed", "storm", "primary", current?.windSpeed ? `${Math.round(current.windSpeed)}<span class=\"text-[10px] font-data-mono text-on-surface-variant ml-1 uppercase\">km/h</span>` : "\u2014", "primary", "M0 10 Q20 5, 40 15 T80 10 T100 12"),
        kpiCard("Solar Load", "wb_sunny", "amber", current?.solarIrradiance ? `${Math.round(current.solarIrradiance)}<span class=\"text-[10px] font-data-mono text-on-surface-variant ml-1 uppercase\">W/m\u00b2</span>` : "\u2014", "amber", "M0 20 Q50 -10, 100 20")
      ),

      // Charts & Forecast Section
      el("div", { class: "grid grid-cols-12 gap-[16px] mt-4" },
        // Main Timeline
        el("div", { class: "col-span-12 lg:col-span-8 bg-surface-container rounded-xl shadow-lg p-[32px]" },
          el("div", { class: "flex justify-between items-center mb-8" },
            el("div", {},
              el("h2", { class: "text-headline-md font-headline-md text-on-surface" }, "24H Environmental Timeline"),
              el("p", { class: "text-body-md font-body-md text-on-surface-variant mt-1" }, "Temperature vs Heat Index Deviation")
            ),
            el("div", { class: "flex gap-4" },
              el("div", { class: "flex items-center gap-2" }, el("div", { class: "w-3 h-3 bg-error rounded-full" }), el("span", { class: "text-[10px] font-data-mono uppercase text-on-surface-variant" }, "Ambient")),
              el("div", { class: "flex items-center gap-2" }, el("div", { class: "w-3 h-3 bg-amber-500 rounded-full" }), el("span", { class: "text-[10px] font-data-mono uppercase text-on-surface-variant" }, "Heat Index"))
            )
          ),
          el("div", { class: "relative h-64 w-full mt-4", id: "env-timeline-chart" })
        ),

        // Secondary Trends & Forecast
        el("div", { class: "col-span-12 lg:col-span-4 flex flex-col gap-[16px]" },
          el("div", { class: "bg-surface-container rounded-xl p-[16px] shadow-md flex flex-col justify-between h-full" },
            el("div", { class: "flex justify-between items-center mb-2" },
              el("span", { class: "text-data-mono font-data-mono text-[10px] uppercase text-on-surface-variant" }, "Humidity Trend"),
              el("span", { class: "text-body-md font-body-md font-bold text-on-surface", id: "humidity-trend-label" }, "\u2014")
            ),
            el("div", { class: "h-16 w-full", id: "humidity-trend-chart" })
          ),
          el("div", { class: "bg-surface-container rounded-xl p-[16px] shadow-md flex flex-col justify-between h-full" },
            el("div", { class: "flex justify-between items-center mb-2" },
              el("span", { class: "text-data-mono font-data-mono text-[10px] uppercase text-on-surface-variant" }, "Wind Gusts"),
              el("span", { class: "text-body-md font-body-md font-bold text-on-surface", id: "wind-gusts-label" }, "\u2014")
            ),
            el("div", { class: "h-16 w-full flex items-end gap-1", id: "wind-gusts-chart" })
          ),
          el("div", { class: "bg-surface-container-low rounded-xl p-[16px] shadow-inner flex flex-col gap-2" },
            el("div", { class: "text-data-mono font-data-mono text-[10px] uppercase text-outline mb-2 tracking-widest" }, "Next 72H Outlook"),
            el("div", { class: "flex items-center justify-between p-2 hover:bg-surface-container-highest rounded-lg transition-colors cursor-default" },
              el("span", { class: "text-data-mono font-data-mono text-on-surface text-[12px]" }, "MON"),
              icon("local_fire_department", "text-error text-[18px]"),
              el("div", { class: "flex gap-2 text-data-mono font-data-mono text-[12px]" }, el("span", { class: "text-error" }, "44\u00b0"), el("span", { class: "text-on-surface-variant" }, "28\u00b0"))
            ),
            el("div", { class: "flex items-center justify-between p-2 hover:bg-surface-container-highest rounded-lg transition-colors cursor-default" },
              el("span", { class: "text-data-mono font-data-mono text-on-surface text-[12px]" }, "TUE"),
              icon("local_fire_department", "text-error text-[18px]"),
              el("div", { class: "flex gap-2 text-data-mono font-data-mono text-[12px]" }, el("span", { class: "text-error" }, "42\u00b0"), el("span", { class: "text-on-surface-variant" }, "27\u00b0"))
            ),
            el("div", { class: "flex items-center justify-between p-2 hover:bg-surface-container-highest rounded-lg transition-colors cursor-default" },
              el("span", { class: "text-data-mono font-data-mono text-on-surface text-[12px]" }, "WED"),
              icon("partly_cloudy_day", "text-primary text-[18px]"),
              el("div", { class: "flex gap-2 text-data-mono font-data-mono text-[12px]" }, el("span", { class: "text-on-surface" }, "38\u00b0"), el("span", { class: "text-on-surface-variant" }, "24\u00b0"))
            )
          )
        )
      )
    )
  );

  host.appendChild(main);

  // Initialize data
  if (place && !env) {
    loadEnvironmentFor(place.id, ctx?.heatmap?.stats?.mean || 30).catch(() => {});
  }

  unsubscribe = subscribe((state) => {
    if (state.environment) {
      updateEnvironmentalData(state.environment);
    }
    if (state.context?.environment) {
      updateEnvironmentalData(state.context.environment);
    }
    if (state.place && state.place.id !== place?.id) {
      loadEnvironmentFor(state.place.id, state.context?.heatmap?.stats?.mean || 30).catch(() => {});
    }
  });

  // Initial render
  if (env) updateEnvironmentalData(env);
}

function kpiCard(label, iconName, iconColor, value, sparklineColor, sparklinePath) {
  const colorMap = { error: "bg-error", primary: "bg-primary", tertiary: "bg-tertiary", amber: "bg-amber-500" };
  return el("div", { class: "bg-surface-container-high rounded-xl p-[16px] shadow-md relative overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-1" },
    el("div", { class: `absolute top-0 right-0 w-16 h-16 rounded-bl-full blur-xl ${colorMap[iconColor]}/10` }),
    el("div", { class: "flex justify-between items-start mb-4" },
      icon(iconName, `text-${iconColor} opacity-80`),
      el("div", { class: `w-2 h-2 rounded-full ${colorMap[iconColor]} shadow-[0_0_8px_theme('colors.${iconColor}')]` })
    ),
    el("div", { class: "text-data-mono font-data-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-1" }, label),
    el("div", { class: "text-headline-lg font-headline-lg text-on-surface" }, value),
    el("div", { class: "mt-4 h-8 w-full" },
      el("svg", { class: "w-full h-full overflow-visible", preserveAspectRatio: "none", viewBox: "0 0 100 20" },
        el("path", { class: "opacity-70", d: sparklinePath, fill: "none", stroke: `theme('colors.${iconColor}')`, "stroke-width": "2" })
      )
    )
  );
}

function aqiValue(aqi) {
  return `${Math.round(aqi)}<span class="text-[10px] font-data-mono text-on-surface-variant ml-1 uppercase">US</span>`;
}

function updateEnvironmentalData(env) {
  const current = env?.current;
  const hourly = env?.hourly;
  if (!current) return;

  // Update location context
  const place = getState().place;
  const coordsEl = document.getElementById("location-coords");
  if (coordsEl && place) {
    coordsEl.textContent = `${place.lat.toFixed(4)}\u00b0 N, ${Math.abs(place.lon).toFixed(4)}\u00b0 ${place.lon < 0 ? "W" : "E"} \u2022 ELEV \u2014`;
  }

  const nameEl = document.getElementById("location-name");
  if (nameEl && place) {
    nameEl.textContent = place.display;
  }

  const riskBadge = document.getElementById("location-risk-badge");
  if (riskBadge) {
    riskBadge.textContent = current.heatIndexC > 40 ? "Critical Zone" : "Monitored";
    riskBadge.className = `bg-error/20 px-3 py-1 rounded-full text-[10px] font-data-mono uppercase tracking-wider text-error animate-pulse ${current.heatIndexC > 40 ? "" : "hidden"}`;
  }

  // Update risk indicator position based on heat index
  const riskIndicator = document.getElementById("risk-indicator");
  if (riskIndicator && current.heatIndexC != null) {
    const pct = Math.min(100, Math.max(0, ((current.heatIndexC - 20) / 30) * 100));
    riskIndicator.style.left = `${pct}%`;
  }

  // Render main timeline chart
  renderTimelineChart(hourly, current);
  renderHumidityTrend(hourly);
  renderWindGusts(hourly);
}

function renderTimelineChart(hourly, current) {
  const container = document.getElementById("env-timeline-chart");
  if (!container || !hourly) return;

  const tempData = hourly.temperature || [];
  const heatIndexData = hourly.heatIndex || [];

  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.innerHTML = "";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padding = { top: 20, right: 20, bottom: 60, left: 70 };
  const cw = w - padding.left - padding.right;
  const ch = h - padding.top - padding.bottom;

  const allVals = [...tempData, ...heatIndexData].filter(v => v != null);
  const maxVal = Math.max(...allVals);
  const minVal = Math.min(...allVals);

  // Grid lines
  ctx.strokeStyle = "#444748";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * (h - padding.top - padding.bottom);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = "#c4c7c7";
  ctx.font = "10px Geist, monospace";
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const val = maxVal - (i / 5) * (maxVal - minVal);
    ctx.fillText(Math.round(val) + "\u00b0", padding.left - 10, padding.top + (i / 5) * (h - padding.top - padding.bottom) + 4);
  }

  // Area fill for heat index
  if (heatIndexData.length) {
    ctx.fillStyle = "#ffb59d33";
    ctx.beginPath();
    ctx.moveTo(padding.left, h - padding.bottom);
    heatIndexData.forEach((val, i) => {
      if (val == null) return;
      const x = padding.left + (i / Math.max(1, heatIndexData.length - 1)) * cw;
      const y = padding.top + (h - padding.top - padding.bottom) * (1 - (val - minVal) / (maxVal - minVal));
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + cw, h - padding.bottom);
    ctx.closePath();
    ctx.fill();
  }

  // Ambient line
  ctx.strokeStyle = "#ffb4ab";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  tempData.forEach((val, i) => {
    if (val == null) return;
    const x = padding.left + (i / Math.max(1, tempData.length - 1)) * cw;
    const y = padding.top + (h - padding.top - padding.bottom) * (1 - (val - minVal) / (maxVal - minVal));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Heat Index line
  ctx.strokeStyle = "#ffb59d";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  heatIndexData.forEach((val, i) => {
    if (val == null) return;
    const x = padding.left + (i / Math.max(1, heatIndexData.length - 1)) * cw;
    const y = padding.top + (h - padding.top - padding.bottom) * (1 - (val - minVal) / (maxVal - minVal));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Current time indicator (14:00 = index 14)
  const nowIdx = 14;
  if (nowIdx < tempData.length) {
    const x = padding.left + (nowIdx / Math.max(1, tempData.length - 1)) * cw;
    ctx.strokeStyle = "#c8c6c5";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dots
    ctx.fillStyle = "#ffb59d";
    ctx.beginPath();
    ctx.arc(x, padding.top + (h - padding.top - padding.bottom) * (1 - (heatIndexData[nowIdx] - minVal) / (maxVal - minVal)), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0c141f";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffb4ab";
    ctx.beginPath();
    ctx.arc(x, padding.top + (h - padding.top - padding.bottom) * (1 - (tempData[nowIdx] - minVal) / (maxVal - minVal)), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // X-axis labels
  ctx.fillStyle = "#c4c7c7";
  ctx.font = "10px Geist, monospace";
  ctx.textAlign = "center";
  const labels = ["00:00", "04:00", "08:00", "12:00", "14:00 (NOW)", "16:00", "20:00", "24:00"];
  labels.forEach((label, i) => {
    const x = padding.left + (i / (labels.length - 1)) * cw;
    ctx.fillStyle = i === 4 ? "#c8c6c5" : "#c4c7c7";
    ctx.font = i === 4 ? "bold 10px Geist, monospace" : "10px Geist, monospace";
    ctx.fillText(label, x, h - padding.bottom + 24);
  });
}

function renderHumidityTrend(hourly) {
  const container = document.getElementById("humidity-trend-chart");
  const labelEl = document.getElementById("humidity-trend-label");
  if (!container || !hourly) return;

  const humidity = hourly.humidity || [];
  if (humidity.length < 2) return;

  const change = humidity[humidity.length - 1] - humidity[0];
  if (labelEl) labelEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(0)}% 24h`;

  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.innerHTML = "";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const cw = w - padding.left - padding.right;
  const ch = h - padding.top - padding.bottom;

  const maxVal = Math.max(...humidity.filter(v => v != null));
  const minVal = Math.min(...humidity.filter(v => v != null));

  ctx.strokeStyle = "#c8c6c5";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  humidity.forEach((val, i) => {
    if (val == null) return;
    const x = padding.left + (i / Math.max(1, humidity.length - 1)) * cw;
    const y = padding.top + ch * (1 - (val - minVal) / (maxVal - minVal));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderWindGusts(hourly) {
  const container = document.getElementById("wind-gusts-chart");
  const labelEl = document.getElementById("wind-gusts-label");
  if (!container || !hourly) return;

  const wind = hourly.windSpeed || hourly.windGust || [];
  if (!wind.length) {
    const mockWind = Array.from({ length: 7 }, () => Math.random() * 40 + 5);
    renderWindBars(container, mockWind);
    if (labelEl) labelEl.textContent = `Peak ${Math.round(Math.max(...mockWind))}km/h`;
    return;
  }

  const maxWind = Math.max(...wind.filter(v => v != null));
  if (labelEl) labelEl.textContent = `Peak ${Math.round(maxWind)}km/h`;
  renderWindBars(container, wind);
}

function renderWindBars(container, data) {
  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.innerHTML = "";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const padding = { top: 5, right: 5, bottom: 5, left: 5 };
  const cw = w - padding.left - padding.right;
  const ch = h - padding.top - padding.bottom;
  const barW = cw / data.length * 0.8;
  const gap = cw / data.length * 0.2;
  const maxVal = Math.max(...data.filter(v => v != null));

  data.forEach((val, i) => {
    if (val == null) return;
    const barH = (val / maxVal) * ch;
    const x = padding.left + i * (barW + gap) + gap / 2;
    const y = padding.top + ch - barH;
    
    const intensity = val / maxVal;
    ctx.fillStyle = intensity > 0.8 ? "#ffb4ab" : intensity > 0.5 ? "#ffb59d" : "#c8c6c5";
    ctx.fillRect(x, y, barW, barH);
  });
}

export function unmount() {
  if (unsubscribe) unsubscribe();
}
