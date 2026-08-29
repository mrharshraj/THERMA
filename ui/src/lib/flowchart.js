// Flowchart / Risk Chain (monochrome — premium enterprise intelligence)

const NODE_COLORS = {
  currentData: "#FFFFFF",
  assumption: "#F5F5F5",
  method: "#E5E5E5",
  scenarioOutput: "#D4D4D4",
  borderCurrent: "#2A2A2A",
  borderAssumption: "#2A2A2A",
  borderMethod: "#2A2A2A",
  borderScenario: "#FFFFFF",
  mutedText: "#737373",
  connectorDefault: "#D4D4D4",
  connectorActive: "#A3A3A3",
  connectorMuted: "#737373"
};

function createSVG(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.overflow = "visible";
  return svg;
}

function node(svg, x, y, label, borderColor, radius = 22, bgFill = "#111111") {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${x},${y})`);

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", bgFill);
  circle.setAttribute("stroke", borderColor);
  circle.setAttribute("stroke-width", "1.5");
  circle.setAttribute("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.3))");
  g.appendChild(circle);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("font-size", "11");
  text.setAttribute("font-weight", "600");
  text.setAttribute("font-family", "Geist, sans-serif");
  text.setAttribute("fill", "#FFFFFF");
  text.textContent = label;
  g.appendChild(text);

  svg.appendChild(g);
  return g;
}

function labelBelow(svg, x, y, text, color = "#737373") {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("font-size", "10");
  t.setAttribute("font-family", "Geist, monospace");
  t.setAttribute("fill", color);
  t.textContent = text;
  svg.appendChild(t);
}

function arrow(svg, x1, y1, x2, y2, color = "#D4D4D4") {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("marker-end", "url(#arrowhead)");
  svg.appendChild(line);

  if (!svg.querySelector("#arrowhead")) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "5");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "2.5");
    marker.setAttribute("orient", "auto");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 8 4, 0 5");
    polygon.setAttribute("fill", color);
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);
  }
}

export function riskChain(exposure) {
  const width = 520;
  const height = 150;
  const svg = createSVG(width, height);

  const chain = [
    { label: "CURRENT DATA", key: "currentData", detail: exposure ? `${Math.round(exposure.temperature || 0)}°F` : "Data loading" },
    { label: "ASSUMPTION", key: "assumption", detail: exposure ? `${exposure.score}/100` : "Computing" },
    { label: "METHOD", key: "method", detail: exposure?.level || "Unknown" },
    { label: "SCENARIO OUTPUT", key: "scenarioOutput", detail: "Estimated outcome" }
  ];

  const spacing = 100;
  const startX = 40;
  const centerY = 65;

  // Draw connections first
  for (let i = 0; i < chain.length - 1; i++) {
    const x1 = startX + i * spacing + 24;
    const x2 = startX + (i + 1) * spacing - 24;
    arrow(svg, x1, centerY, x2, centerY);
  }

  // Draw nodes with grayscale hierarchy
  chain.forEach((item, i) => {
    const x = startX + i * spacing;
    const n = node(svg, x, centerY, item.label, NODE_COLORS[`border${item.key.charAt(0).toUpperCase() + item.key.slice(1)`] || NODE_COLORS.borderAssumption], 24, NODE_COLORS[item.key] || "#111111");
    labelBelow(svg, x, centerY + 42, item.detail, NODE_COLORS.mutedText);
  });

  return svg;
}

export function flowchart(nodes, edges) {
  // Generic flowchart renderer — monochrome
  const width = 620;
  const height = 420;
  const svg = createSVG(width, height);

  // Simple top-down layout
  const levels = {};
  nodes.forEach(n => {
    if (!levels[n.level]) levels[n.level] = [];
    levels[n.level].push(n);
  });

  const levelKeys = Object.keys(levels).sort((a, b) => a - b);
  const levelHeight = height / (levelKeys.length + 1);

  levelKeys.forEach((levelKey, li) => {
    const levelNodes = levels[levelKey];
    const spacing = width / (levelNodes.length + 1);
    levelNodes.forEach((n, ni) => {
      const x = spacing * (ni + 1);
      const y = levelHeight * (li + 1);
      const borderColor = NODE_COLORS.borderCurrent;
      const bgFill = "#111111";
      const radius = 22;
      node(svg, x, y, n.label, borderColor, radius, bgFill);
      if (n.detail) labelBelow(svg, x, y + 40, n.detail, NODE_COLORS.mutedText);
    });
  });

  edges.forEach(e => {
    const from = nodes.find(n => n.id === e.from);
    const to = nodes.find(n => n.id === e.to);
    if (from && to) {
      const fromX = from._x, fromY = from._y;
      const toX = to._x, toY = to._y;
      arrow(fromX, fromY + 22, toX, toY - 22, NODE_COLORS.connectorDefault);
    }
  });

  return svg;
}