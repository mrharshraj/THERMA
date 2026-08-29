// Visualization workspace (ported from public/app/visuals.js)

const vizEl = document.getElementById("viz-workspace");
const vizBody = document.getElementById("viz-body");
const vizTitle = document.getElementById("viz-title");
const vizIcon = document.getElementById("viz-icon");
const vizSourceBadge = document.getElementById("viz-source-badge");
const vizClose = document.getElementById("viz-close");
const vizExpand = document.getElementById("viz-expand");
const vizFullscreen = document.getElementById("viz-fullscreen");

export function show({ title, iconName, source, demo, sticky, build }) {
  if (!vizEl || !vizBody) return;
  
  vizTitle.textContent = title || "Analysis";
  vizIcon.textContent = iconName || "insights";
  vizSourceBadge.textContent = demo ? "DEMO" : (source === "therma-analysis" ? "THERMA ANALYSIS" : source?.toUpperCase() || "LIVE");
  vizSourceBadge.className = "source-badge " + (demo ? "demo" : source === "therma-analysis" ? "therma-analysis" : "live");
  
  vizBody.innerHTML = "";
  if (build) build(vizBody);
  
  vizEl.classList.remove("hidden");
  vizEl.classList.remove("screen-exit", "screen-exit-active");
  vizEl.classList.add("screen-enter", "screen-enter-active");
}

export function hide() {
  if (!vizEl) return;
  vizEl.classList.add("hidden");
  vizBody.innerHTML = "";
}

export function splitPanels(panels) {
  const container = el("div", { class: "grid grid-cols-1 lg:grid-cols-2 gap-4" });
  for (const panel of panels) {
    if (!panel.node) continue;
    const card = el("div", { class: "bg-surface rounded-xl p-4" },
      el("h4", { class: "font-data text-[10px] uppercase text-on-surface-variant mb-2" }, panel.title),
      panel.node
    );
    container.appendChild(card);
  }
  return container;
}

export function kpiStrip(items) {
  return el("div", { class: "grid grid-cols-2 gap-3" },
    ...items.map(item => el("div", { class: "bg-surface-container p-3 rounded-lg" },
      el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant" }, item.label),
      el("div", { class: "font-body font-semibold text-on-surface mt-1" }, item.value)
    ))
  );
}

export function initVizWorkspace() {
  vizClose?.addEventListener("click", hide);
  vizExpand?.addEventListener("click", () => {
    vizEl.classList.toggle("max-h-[80vh]");
  });
  vizFullscreen?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else vizEl.requestFullscreen?.();
  });
}
