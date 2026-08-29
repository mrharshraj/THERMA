// SVG Charts (ported from public/app/charts.js)

const CHART_COLORS = ["#f97316", "#2b7de9", "#ffb59d", "#c8c6c5", "#b91c1c", "#57b1ff", "#fed7aa"];

function createSVG(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.overflow = "visible";
  return svg;
}

export function lineChart({ labels, series, yFmt, width = 400, height = 200, area = false, animate = true }) {
  const svg = createSVG(width, height);
  const padding = { top: 20, right: 10, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allPoints = series.flatMap(s => s.points);
  const maxVal = Math.max(...allPoints.filter(p => p != null));
  const minVal = Math.min(...allPoints.filter(p => p != null));

  const xScale = i => padding.left + (i / Math.max(1, labels.length - 1)) * chartW;
  const yScale = val => padding.top + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (i / 4) * chartH;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding.left);
    line.setAttribute("x2", width - padding.right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#444748");
    line.setAttribute("stroke-width", "0.5");
    line.setAttribute("stroke-dasharray", "2,2");
    svg.appendChild(line);
  }

  // Y-axis labels
  for (let i = 0; i <= 4; i++) {
    const val = maxVal - (i / 4) * (maxVal - minVal);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", padding.left - 8);
    text.setAttribute("y", padding.top + (i / 4) * chartH + 4);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "Geist, monospace");
    text.setAttribute("fill", "#c4c7c7");
    text.textContent = yFmt ? yFmt(val) : val.toFixed(1);
    svg.appendChild(text);
  }

  series.forEach((s, si) => {
    const color = s.color || CHART_COLORS[si % CHART_COLORS.length];
    const validPoints = s.points.map((p, i) => p != null ? { x: xScale(i), y: yScale(p) } : null).filter(Boolean);

    if (area && validPoints.length) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      let d = `M${validPoints[0].x},${height - padding.bottom}`;
      validPoints.forEach(p => d += ` L${p.x},${p.y}`);
      d += ` L${validPoints[validPoints.length - 1].x},${height - padding.bottom} Z`;
      path.setAttribute("d", d);
      path.setAttribute("fill", color + "33");
      svg.appendChild(path);
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let d = "";
    validPoints.forEach((p, i) => {
      d += `${i === 0 ? "M" : "L"}${p.x},${p.y} `;
    });
    path.setAttribute("d", d.trim());
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    if (animate) {
      path.setAttribute("stroke-dasharray", path.getTotalLength());
      path.setAttribute("stroke-dashoffset", path.getTotalLength());
      path.animate([
        { strokeDashoffset: path.getTotalLength() },
        { strokeDashoffset: 0 }
      ], { duration: 800, easing: "ease-out", fill: "forwards" });
    }
    svg.appendChild(path);

    // Data points
    validPoints.forEach(p => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", p.x);
      circle.setAttribute("cy", p.y);
      circle.setAttribute("r", "4");
      circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "#0c141f");
      circle.setAttribute("stroke-width", "2");
      svg.appendChild(circle);
    });
  });

  // X-axis labels
  labels.forEach((label, i) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", xScale(i));
    text.setAttribute("y", height - padding.bottom + 18);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "Geist, monospace");
    text.setAttribute("fill", "#c4c7c7");
    text.textContent = label;
    svg.appendChild(text);
  });

  return svg;
}

export function barChart({ items, fmt, width = 300, height = 200, animate = true }) {
  const svg = createSVG(width, height);
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...items.map(i => i.value));
  const barW = chartW / items.length * 0.7;
  const gap = chartW / items.length * 0.3;

  // Y-axis
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (i / 4) * chartH;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding.left);
    line.setAttribute("x2", width - padding.right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#444748");
    line.setAttribute("stroke-width", "0.5");
    line.setAttribute("stroke-dasharray", "2,2");
    svg.appendChild(line);
  }

  items.forEach((item, i) => {
    const x = padding.left + i * (barW + gap) + gap / 2;
    const barH = (item.value / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", animate ? padding.top + chartH : y);
    rect.setAttribute("width", barW);
    rect.setAttribute("height", animate ? 0 : barH);
    rect.setAttribute("fill", item.color || "#f97316");
    rect.setAttribute("rx", "4");
    if (animate) {
      rect.animate([
        { y: padding.top + chartH, height: 0 },
        { y, height: barH }
      ], { duration: 600, easing: "ease-out", fill: "forwards", delay: i * 80 });
    }
    svg.appendChild(rect);

    // Value label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x + barW / 2);
    text.setAttribute("y", y - 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "11");
    text.setAttribute("font-family", "Geist, monospace");
    text.setAttribute("fill", "#444748");
    text.textContent = fmt ? fmt(item.value) : item.value;
    svg.appendChild(text);

    // Label
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x + barW / 2);
    label.setAttribute("y", height - padding.bottom + 16);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "Geist, monospace");
    label.setAttribute("fill", "#c4c7c7");
    label.textContent = item.label;
    svg.appendChild(label);
  });

  return svg;
}

export function ringGauge({ value, label, color = "#f97316", sublabel, width = 180, height = 180 }) {
  const svg = createSVG(width, height);
  const r = 60;
  const cx = width / 2;
  const cy = height / 2;
  const strokeW = 12;

  const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bgCircle.setAttribute("cx", cx);
  bgCircle.setAttribute("cy", cy);
  bgCircle.setAttribute("r", r);
  bgCircle.setAttribute("fill", "none");
  bgCircle.setAttribute("stroke", "#444748");
  bgCircle.setAttribute("stroke-width", strokeW);
  svg.appendChild(bgCircle);

  const pct = value != null ? Math.max(0, Math.min(100, value)) / 100 : 0;
  const circumference = 2 * Math.PI * r;
  const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  progressCircle.setAttribute("cx", cx);
  progressCircle.setAttribute("cy", cy);
  progressCircle.setAttribute("r", r);
  progressCircle.setAttribute("fill", "none");
  progressCircle.setAttribute("stroke", color);
  progressCircle.setAttribute("stroke-width", strokeW);
  progressCircle.setAttribute("stroke-linecap", "round");
  progressCircle.setAttribute("stroke-dasharray", circumference);
  progressCircle.setAttribute("stroke-dashoffset", circumference * (1 - pct));
  progressCircle.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
  svg.appendChild(progressCircle);

  const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  textGroup.setAttribute("text-anchor", "middle");
  textGroup.setAttribute("font-family", "Geist, sans-serif");
  textGroup.setAttribute("fill", "#dce2f3");

  const valText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  valText.setAttribute("x", cx);
  valText.setAttribute("y", cy - 8);
  valText.setAttribute("font-size", "36");
  valText.setAttribute("font-weight", "700");
  valText.textContent = value != null ? Math.round(value) + (label?.includes("Exposure") ? "" : "\u00b0") : "\u2014";
  textGroup.appendChild(valText);

  if (label) {
    const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    labelText.setAttribute("x", cx);
    labelText.setAttribute("y", cy + 24);
    labelText.setAttribute("font-size", "12");
    labelText.setAttribute("font-weight", "600");
    labelText.setAttribute("fill", "#c4c7c7");
    labelText.textContent = label;
    textGroup.appendChild(labelText);
  }

  if (sublabel) {
    const subText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subText.setAttribute("x", cx);
    subText.setAttribute("y", cy + 42);
    subText.setAttribute("font-size", "10");
    subText.setAttribute("fill", "#c4c7c7");
    subText.textContent = sublabel;
    textGroup.appendChild(subText);
  }

  svg.appendChild(textGroup);
  return svg;
}

export function distributionArea({ axis, counts, width = 400, height = 200 }) {
  const svg = createSVG(width, height);
  const padding = { top: 20, right: 10, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxCount = Math.max(...counts);
  const minVal = axis[0];
  const maxVal = axis[axis.length - 1];

  const xScale = (val) => padding.left + ((val - minVal) / (maxVal - minVal)) * chartW;
  const yScale = (count) => padding.top + chartH - (count / maxCount) * chartH;

  // Area
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  let d = `M${padding.left},${height - padding.bottom}`;
  axis.forEach((val, i) => {
    d += ` L${xScale(val)},${yScale(counts[i])}`;
  });
  d += ` L${width - padding.right},${height - padding.bottom} Z`;
  path.setAttribute("d", d);
  path.setAttribute("fill", "#f9731633");
  svg.appendChild(path);

  // Line
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  let ld = `M${padding.left},${yScale(counts[0])}`;
  axis.forEach((val, i) => {
    ld += ` L${xScale(val)},${yScale(counts[i])}`;
  });
  line.setAttribute("d", ld);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#f97316");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);

  // X-axis labels
  axis.forEach((val, i) => {
    if (i % Math.ceil(axis.length / 6) !== 0) return;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", xScale(val));
    text.setAttribute("y", height - padding.bottom + 18);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "Geist, monospace");
    text.setAttribute("fill", "#c4c7c7");
    text.textContent = Math.round(val) + "\u00b0";
    svg.appendChild(text);
  });

  return svg;
}

export function donut({ segments, centerLabel, centerSub, width = 180, height = 180 }) {
  const svg = createSVG(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const r = 60;
  const strokeW = 12;

  let currentAngle = -90;
  const total = segments.reduce((a, b) => a + b.value, 0);

  segments.forEach(seg => {
    const angle = (seg.value / total) * 360;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + angle) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", seg.color);
    path.setAttribute("stroke-width", strokeW);
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    currentAngle += angle;
  });

  // Center text
  const textGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  textGroup.setAttribute("text-anchor", "middle");
  textGroup.setAttribute("font-family", "Geist, sans-serif");
  textGroup.setAttribute("fill", "#dce2f3");

  const mainText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  mainText.setAttribute("x", cx);
  mainText.setAttribute("y", cy - 4);
  mainText.setAttribute("font-size", "28");
  mainText.setAttribute("font-weight", "700");
  mainText.textContent = centerLabel;
  textGroup.appendChild(mainText);

  if (centerSub) {
    const subText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subText.setAttribute("x", cx);
    subText.setAttribute("y", cy + 20);
    subText.setAttribute("font-size", "11");
    subText.setAttribute("fill", "#c4c7c7");
    subText.textContent = centerSub;
    textGroup.appendChild(subText);
  }

  svg.appendChild(textGroup);
  return svg;
}
