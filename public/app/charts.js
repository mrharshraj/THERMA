// Reusable responsive SVG charts. All builders return an element with a
// viewBox so charts scale to their container. Dark mode aware via CSS vars.

import { el } from './widgets.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function makeSvg(w, h, cls = '') {
  // width/height go through CSS (style), not SVG geometry attributes: the height
  // *attribute* only accepts a length, so height="auto" throws "Expected length".
  const s = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: cls, role: 'img', style: 'width:100%;height:auto;display:block' });
  return s;
}

const GRID = 'rgba(116,120,120,0.25)';
const TXT = 'currentColor';

// ---------- line / area chart ----------
// series: [{name,color,points:[numbers]}], labels: [strings]
export function lineChart({ series, labels, height = 190, area = true, yFmt = (v) => v, yMinForce = null }) {
  const w = 560;
  const padL = 42, padR = 12, padT = 14, padB = 26;
  const all = series.flatMap((s) => s.points.filter((v) => v != null));
  if (!all.length) return emptyChart();
  let min = yMinForce != null ? yMinForce : Math.min(...all);
  let max = Math.max(...all);
  const span = max - min || 1;
  min -= span * 0.08; max += span * 0.08;
  const iw = w - padL - padR, ihh = height - padT - padB;
  const x = (i) => padL + (i / Math.max(1, labels.length - 1)) * iw;
  const y = (v) => padT + ihh - ((v - min) / (max - min)) * ihh;

  const s = makeSvg(w, height);
  // gridlines + y labels
  for (let g = 0; g <= 3; g++) {
    const gv = min + ((max - min) * g) / 3;
    const gy = y(gv);
    s.appendChild(svgEl('line', { x1: padL, x2: w - padR, y1: gy, y2: gy, stroke: GRID, 'stroke-width': 1 }));
    const t = svgEl('text', { x: padL - 6, y: gy + 4, 'text-anchor': 'end', 'font-size': 10, fill: TXT, opacity: 0.65 });
    t.textContent = yFmt(gv);
    s.appendChild(t);
  }
  // x labels (max 6)
  const stepX = Math.ceil(labels.length / 6);
  labels.forEach((lb, i) => {
    if (i % stepX !== 0 && i !== labels.length - 1) return;
    const t = svgEl('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', 'font-size': 10, fill: TXT, opacity: 0.65 });
    t.textContent = lb;
    s.appendChild(t);
  });
  for (const ser of series) {
    const pts = ser.points.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
    if (!pts.length) continue;
    if (area) {
      const d = `M${pts[0]} L${pts.join(' L')} L${pts[pts.length - 1].split(',')[0]},${y(min)} L${pts[0].split(',')[0]},${y(min)} Z`;
      s.appendChild(svgEl('path', { d, fill: ser.color, opacity: 0.12 }));
    }
    s.appendChild(svgEl('path', {
      d: `M${pts.join(' L')}`, fill: 'none', stroke: ser.color,
      'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    // end dot
    const [ex, ey] = pts[pts.length - 1].split(',').map(Number);
    s.appendChild(svgEl('circle', { cx: ex, cy: ey, r: 3.4, fill: ser.color }));
  }
  return legendWrap(s, series);
}

// ---------- vertical columns ----------
export function columnChart({ items, height = 200, yFmt = (v) => String(Math.round(v)) }) {
  const w = 560, padL = 40, padR = 10, padT = 18, padB = 30;
  const vals = items.map((i) => i.value).filter((v) => v != null);
  if (!vals.length) return emptyChart();
  const max = Math.max(...vals) * 1.08 || 1;
  const iw = w - padL - padR, ihh = height - padT - padB;
  const bw = Math.min(64, (iw / items.length) * 0.6);
  const s = makeSvg(w, height);
  for (let g = 0; g <= 3; g++) {
    const gv = (max * g) / 3;
    const gy = padT + ihh - (gv / max) * ihh;
    s.appendChild(svgEl('line', { x1: padL, x2: w - padR, y1: gy, y2: gy, stroke: GRID }));
    const t = svgEl('text', { x: padL - 6, y: gy + 4, 'text-anchor': 'end', 'font-size': 10, fill: TXT, opacity: 0.65 });
    t.textContent = yFmt(gv);
    s.appendChild(t);
  }
  items.forEach((it, i) => {
    const cx = padL + (iw / items.length) * (i + 0.5);
    const hgt = (it.value / max) * ihh;
    const r = svgEl('rect', {
      x: cx - bw / 2, y: padT + ihh - hgt, width: bw, height: hgt,
      rx: 7, fill: it.color || '#f97316', opacity: 0.92,
    });
    s.appendChild(r);
    const vt = svgEl('text', { x: cx, y: padT + ihh - hgt - 6, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: TXT });
    vt.textContent = yFmt(it.value);
    s.appendChild(vt);
    const lt = svgEl('text', { x: cx, y: height - 9, 'text-anchor': 'middle', 'font-size': 10.5, fill: TXT, opacity: 0.75 });
    lt.textContent = it.label;
    s.appendChild(lt);
  });
  return s;
}

// ---------- horizontal bars ----------
export function barChart({ items, maxOverride = null, fmt = (v) => String(v) }) {
  const rowH = 34, w = 560, labelW = 148, valW = 74;
  const h = Math.max(80, items.length * rowH + 8);
  const max = maxOverride != null ? maxOverride : Math.max(...items.map((i) => i.value).filter((v) => v != null)) || 1;
  const s = makeSvg(w, h);
  items.forEach((it, i) => {
    const yy = i * rowH + 8;
    const lt = svgEl('text', { x: 0, y: yy + 15, 'font-size': 11.5, fill: TXT, opacity: 0.85 });
    lt.textContent = String(it.label).slice(0, 24);
    s.appendChild(lt);
    const trackW = w - labelW - valW;
    s.appendChild(svgEl('rect', { x: labelW, y: yy, width: trackW, height: 17, rx: 8.5, fill: GRID, opacity: 0.35 }));
    const pctv = Math.max(0.02, Math.min(1, it.value / max));
    s.appendChild(svgEl('rect', { x: labelW, y: yy, width: Math.max(6, trackW * pctv), height: 17, rx: 8.5, fill: it.color || '#f97316' }));
    const vt = svgEl('text', { x: w, y: yy + 14, 'text-anchor': 'end', 'font-size': 11.5, 'font-weight': 700, fill: TXT });
    vt.textContent = fmt(it.value);
    s.appendChild(vt);
  });
  return s;
}

// ---------- ring gauge ----------
export function ringGauge({ value, size = 132, label, sublabel, color = '#f97316' }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, (value ?? 0) / 100));
  const s = makeSvg(size, size);
  s.setAttribute('style', `width:${size}px;height:${size}px`);
  s.appendChild(svgEl('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: GRID, 'stroke-width': stroke, opacity: 0.4 }));
  const arc = svgEl('circle', {
    cx: size / 2, cy: size / 2, r, fill: 'none', stroke: color, 'stroke-width': stroke,
    'stroke-linecap': 'round', 'stroke-dasharray': `${c * frac} ${c}`,
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  });
  s.appendChild(arc);
  const vt = svgEl('text', { x: size / 2, y: size / 2 - 2, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, fill: TXT });
  vt.textContent = value != null ? String(value) : '—';
  s.appendChild(vt);
  const lt = svgEl('text', { x: size / 2, y: size / 2 + 18, 'text-anchor': 'middle', 'font-size': 10.5, fill: TXT, opacity: 0.75 });
  lt.textContent = label || '';
  s.appendChild(lt);
  const wrap = el('div', { class: 'flex flex-col items-center gap-1' });
  wrap.appendChild(s);
  if (sublabel) wrap.appendChild(el('div', { class: 'text-[11px] font-semibold text-on-surface-variant text-center' }, sublabel));
  return wrap;
}

// ---------- donut ----------
export function donut({ segments, size = 150, thickness = 20, centerLabel, centerSub }) {
  const r = (size - thickness) / 2;
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const s = makeSvg(size, size);
  s.setAttribute('style', `width:${size}px;height:${size}px`);
  let acc = 0;
  for (const seg of segments) {
    if (!seg.value) continue;
    const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += seg.value;
    const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = size / 2 + r * Math.cos(startAngle), y1 = size / 2 + r * Math.sin(startAngle);
    const x2 = size / 2 + r * Math.cos(endAngle), y2 = size / 2 + r * Math.sin(endAngle);
    s.appendChild(svgEl('path', {
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      fill: 'none', stroke: seg.color, 'stroke-width': thickness, 'stroke-linecap': 'butt',
    }, ));
  }
  if (centerLabel) {
    const vt = svgEl('text', { x: size / 2, y: size / 2 + 1, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 900, fill: TXT });
    vt.textContent = centerLabel;
    s.appendChild(vt);
    if (centerSub) {
      const st = svgEl('text', { x: size / 2, y: size / 2 + 18, 'text-anchor': 'middle', 'font-size': 10, fill: TXT, opacity: 0.7 });
      st.textContent = centerSub;
      s.appendChild(st);
    }
  }
  const legend = el('div', { class: 'flex flex-col gap-1.5' },
    segments.filter((g) => g.value > 0).map((g) => el('div', { class: 'flex items-center gap-2 text-[12px]' },
      el('span', { class: 'w-2.5 h-2.5 rounded-full shrink-0', style: { background: g.color } }),
      el('span', { class: 'font-semibold' }, g.label),
      el('span', { class: 'text-on-surface-variant ml-auto font-bold' }, String(g.value)))));
  return el('div', { class: 'flex items-center gap-md flex-wrap justify-center' }, s, legend);
}

// ---------- temperature distribution histogram ----------
export function distributionArea({ axis, counts, color = '#f97316', height = 170, xFmt = (v) => `${Math.round(v * 9 / 5 + 32)}°F` }) {
  if (!axis || !axis.length || !counts || !counts.length) return emptyChart('No distribution data in this payload.');
  const w = 560, padL = 36, padR = 12, padT = 12, padB = 28;
  const max = Math.max(...counts) || 1;
  const iw = w - padL - padR, ihh = height - padT - padB;
  const x = (i) => padL + (i / Math.max(1, axis.length - 1)) * iw;
  const y = (v) => padT + ihh - (v / max) * ihh;
  const pts = counts.map((c, i) => `${x(i)},${y(c)}`).join(' L');
  const s = makeSvg(w, height);
  s.appendChild(svgEl('path', { d: `M${padL},${padT + ihh} L${pts} L${w - padR},${padT + ihh} Z`, fill: color, opacity: 0.16 }));
  s.appendChild(svgEl('path', { d: `M${pts}`, fill: 'none', stroke: color, 'stroke-width': 2.2 }));
  const stepX = Math.ceil(axis.length / 7);
  axis.forEach((v, i) => {
    if (i % stepX !== 0 && i !== axis.length - 1) return;
    s.appendChild(svgEl('line', { x1: x(i), x2: x(i), y1: padT, y2: padT + ihh, stroke: GRID, opacity: 0.35 }));
    const t = svgEl('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', 'font-size': 9.5, fill: TXT, opacity: 0.7 });
    t.textContent = xFmt(v);
    s.appendChild(t);
  });
  return s;
}

// ---------- grouped comparison ----------
export function comparisonBars({ groups, seriesNames, colors }) {
  const w = 560, groupGap = 46, padL = 118, valW = 66, rowH = 26, topPad = 8;
  const rows = groups.length * seriesNames.length;
  const h = rows * rowH + groups.length * groupGap + topPad;
  const allVals = groups.flatMap((g) => g.values.filter((v) => v != null));
  if (!allVals.length) return emptyChart();
  const max = Math.max(...allVals) || 1;
  const s = makeSvg(w, h);
  let yy = topPad;
  groups.forEach((g) => {
    const gt = svgEl('text', { x: 0, y: yy + 14, 'font-size': 12, 'font-weight': 800, fill: TXT });
    gt.textContent = g.label.slice(0, 18);
    s.appendChild(gt);
    yy += 20;
    g.values.forEach((v, si) => {
      const trackW = w - padL - valW;
      s.appendChild(svgEl('rect', { x: padL, y: yy, width: trackW, height: 14, rx: 7, fill: GRID, opacity: 0.3 }));
      if (v != null) {
        s.appendChild(svgEl('rect', { x: padL, y: yy, width: Math.max(6, trackW * (v / max)), height: 14, rx: 7, fill: colors[si] }));
        const vt = svgEl('text', { x: w, y: yy + 12, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: TXT });
        vt.textContent = String(Math.round(v * 10) / 10);
        s.appendChild(vt);
      }
      const nm = svgEl('text', { x: padL - 8, y: yy + 12, 'text-anchor': 'end', 'font-size': 10.5, fill: TXT, opacity: 0.7 });
      nm.textContent = seriesNames[si];
      s.appendChild(nm);
      yy += rowH;
    });
    yy += groupGap - 26;
  });
  return legendWrap(s, seriesNames.map((n, i) => ({ name: n, color: colors[i] })));
}

// ---------- sparkline ----------
export function sparkline(points, color = '#f97316', w = 120, h = 34) {
  const vals = points.filter((v) => v != null);
  if (vals.length < 2) return emptyChart();
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = points.map((v, i) => v == null ? null : `${(i / (points.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).filter(Boolean);
  const s = makeSvg(w, h);
  s.setAttribute('style', `width:${w}px;height:${h}px`);
  s.appendChild(svgEl('path', { d: `M${pts.join(' L')}`, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  return s;
}

function legendWrap(svg, series) {
  if (!series || series.length < 2) return svg;
  const legend = el('div', { class: 'flex items-center gap-sm flex-wrap justify-center mt-1' },
    series.map((sr) => el('span', { class: 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant' },
      el('span', { class: 'w-4 rounded-full inline-block', style: { background: sr.color, height: '4px' } }),
      sr.name)));
  return el('div', {}, svg, legend);
}

function emptyChart(msg = 'No data available yet.') {
  return el('div', { class: 'flex items-center justify-center text-[12px] text-on-surface-variant/70 py-lg' }, msg);
}
