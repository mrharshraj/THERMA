// UI widget helpers (ported from public/app/widgets.js)

export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") {
      element.className = value;
    } else if (key === "dataset") {
      for (const [k, v] of Object.entries(value)) {
        element.dataset[k] = v;
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in element) {
      element[key] = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    if (typeof child === "string" || typeof child === "number") {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  return element;
}

export function icon(name, size = "text-[18px]", filled = false) {
  return el("span", { class: `material-symbols-outlined ${size} ${filled ? "text-primary" : ""}` }, name);
}

export function toast(message, type = "info") {
  const container = document.getElementById("toasts");
  if (!container) return;
  
  const colors = {
    info: { bg: "bg-primary", text: "text-on-primary", icon: "info" },
    success: { bg: "bg-emerald-500", text: "text-white", icon: "check_circle" },
    warn: { bg: "bg-amber-500", text: "text-white", icon: "warning" },
    error: { bg: "bg-error", text: "text-on-error", icon: "error" }
  };
  
  const c = colors[type] || colors.info;
  const t = el("div", { class: `toast ${c.bg} ${c.text} px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-sm` },
    icon(c.icon, "text-[20px]", true),
    el("span", { class: "font-body text-[13px]" }, message),
    el("button", { class: "ml-2 p-1 hover:bg-black/10 rounded-full", onclick: () => t.remove() }, icon("close", "text-[18px]"))
  );
  
  container.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 5000);
}

export function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export function tempF(c, decimals = 0) {
  if (c == null) return "\u2014";
  const f = (c * 9) / 5 + 32;
  return f.toFixed(decimals) + "\u00b0F";
}

export function bothTemps(c, decimals = 1) {
  if (c == null) return "\u2014";
  return `${c.toFixed(decimals)}\u00b0C / ${tempF(c, 0)}`;
}

export function num(n, decimals = 1) {
  if (n == null) return "\u2014";
  return n.toFixed(decimals);
}

export function km(m) {
  if (m == null) return "\u2014";
  return (m / 1000).toFixed(1) + " km";
}

export function mins(s) {
  if (s == null) return "\u2014";
  return Math.round(s / 60) + " min";
}

export function severityChip(severity) {
  const colors = {
    Critical: "bg-error/20 text-error border-error/30",
    High: "bg-tertiary/20 text-tertiary border-tertiary/30",
    Medium: "bg-amber-500/20 text-amber-500 border-amber-500/30",
    Low: "bg-primary/20 text-primary border-primary/30",
    Standard: "bg-primary/20 text-primary border-primary/30"
  };
  return el("span", { class: `px-2 py-0.5 rounded-full text-[10px] font-data font-semibold border ${colors[severity] || colors.Standard}` }, severity);
}
