// "Best Time to Go Outside" — operational outdoor-suitability windows computed
// from the REAL hourly environmental series (/api/environment). Nothing here is
// fabricated: if the hourly arrays are absent the feature renders an explicit
// unavailable state. All thresholds are operational guidance (OSHA-style
// work/rest logic), not medical claims.

import { el, icon, tempF } from './widgets.js';

// Heat-index bands (°C) that drive the three window categories. Aligned with
// the platform's exposure philosophy: heat index is the primary driver because
// it already compounds humidity with temperature.
const GOOD_HI = 30;      // < 30°C (< ~86°F)        → suitable
const HIGH_HI = 33;      // >= 33°C (>= ~91.4°F)    → high risk; between = caution

// Activity guidance thresholds (heat index °C). Operational, not medical.
const ACTIVITIES = [
  { id: 'walking', label: 'Walking / errands', ic: 'directions_walk', maxHi: 33 },
  { id: 'exercise', label: 'Exercise / running', ic: 'sprint', maxHi: 30 },
  { id: 'work', label: 'Outdoor work', ic: 'construction', maxHi: 32 },
  { id: 'prolonged', label: 'Prolonged exposure', ic: 'schedule', maxHi: 29 },
];

function hourLabel(h) {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? 'AM' : 'PM';
  const base = hr % 12 === 0 ? 12 : hr % 12;
  return `${base}:00 ${ampm}`;
}

function shortLabel(h) {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? 'AM' : 'PM';
  const base = hr % 12 === 0 ? 12 : hr % 12;
  return `${base}${ampm}`;
}

function cleanSeries(arr, len) {
  return Array.from({ length: len }, (_, i) => {
    const v = arr ? Number(arr[i]) : NaN;
    return Number.isFinite(v) ? v : null;
  });
}

function categoryFor(hi) {
  if (hi == null) return 'unknown';
  if (hi < GOOD_HI) return 'good';
  if (hi < HIGH_HI) return 'caution';
  return 'high';
}

const CAT_COLOR = { good: '#8a8a8a', caution: '#f5c26b', high: '#f97316', extreme: '#b91c1c', unknown: '#3a3a3a' };

function runsByCategory(hours) {
  const runs = [];
  let cur = null;
  hours.forEach((h) => {
    if (cur && cur.category === h.category && h.h === cur.to + 1) {
      cur.to = h.h;
    } else {
      if (cur) runs.push(cur);
      cur = { category: h.category, from: h.h, to: h.h };
    }
  });
  if (cur) runs.push(cur);
  return runs;
}

// env: normalized /api/environment payload ({ hourly, current, fetchedAt, source })
export function computeBestTime(env) {
  const hourly = env && env.hourly;
  if (!hourly) return null;
  const len = Math.max(
    (hourly.heatIndex || []).length,
    (hourly.temperature || []).length,
  );
  if (!len) return null;

  const hi = cleanSeries(hourly.heatIndex, len);
  const temp = cleanSeries(hourly.temperature, len);
  const wb = cleanSeries(hourly.wetBulb, len);
  const hum = cleanSeries(hourly.humidity, len);

  const hours = hi.map((v, i) => ({
    h: i,
    hi,
    // Use heat index when present; fall back to temperature so the feature
    // still works on payloads that only carry the base series.
    hiUsed: hi[i] != null ? hi[i] : temp[i],
    temp: temp[i],
    wb: wb[i],
    hum: hum[i],
    category: categoryFor(hi[i] != null ? hi[i] : temp[i]),
  })).filter((x) => x.hiUsed != null);
  if (!hours.length) return null;

  const windows = runsByCategory(hours);
  const pick = (cat) => windows
    .filter((w) => w.category === cat)
    .sort((a, b) => (b.to - b.from) - (a.to - a.from))[0] || null;

  const best = pick('good');
  const caution = pick('caution');
  const high = pick('high');

  const peak = hours.reduce((a, b) => (b.hiUsed > a.hiUsed ? b : a), hours[0]);
  const coolest = hours.reduce((a, b) => (b.hiUsed < a.hiUsed ? b : a), hours[0]);
  const nowHour = new Date().getHours();
  const nowIdx = Math.min(len - 1, nowHour % len);

  const activityWindows = ACTIVITIES.map((act) => {
    const ok = hours.filter((x) => x.hiUsed < act.maxHi);
    const win = ok.length ? runsByCategory(ok.map((x) => ({ ...x, category: 'ok' })))
      .sort((a, b) => (b.to - b.from) - (a.to - a.from))[0] : null;
    return { ...act, window: win };
  });

  return {
    hours, windows, best, caution, high, peak, coolest,
    nowHour, nowIdx, activityWindows,
    fetchedAt: env.fetchedAt,
    source: env.source,
    demo: env.source === 'therma-demo' || env.source === 'demo',
  };
}

function whyLines(bt) {
  const lines = [];
  if (bt.best) {
    const from = bt.hours.find((x) => x.h === bt.best.from);
    if (from && from.hiUsed != null) {
      lines.push(`Heat index around ${tempF(from.hiUsed, 0)} at the start of the window — below the ${tempF(GOOD_HI, 0)} suitability line.`);
    }
    if (from && from.hum != null) lines.push(`Humidity near ${Math.round(from.hum)}% — heat compounding is limited.`);
    if (from && from.temp != null) lines.push(`Air temperature about ${tempF(from.temp, 0)}.`);
  }
  if (bt.peak && bt.peak.hiUsed != null) {
    lines.push(`Conditions peak near ${shortLabel(bt.peak.h)} at ${tempF(bt.peak.hiUsed, 0)} heat index — plan around it.`);
  }
  return lines;
}

// ---- 24h suitability graph (SVG, monochrome chrome + heat colors for data) ----
function bestTimeGraph(bt, { height = 150 } = {}) {
  const w = 560;
  const padL = 30, padR = 8, padT = 12, padB = 22;
  const iw = w - padL - padR;
  const ih = height - padT - padB;
  const hours = bt.hours;
  const vals = hours.map((x) => x.hiUsed);
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  min -= span * 0.1; max += span * 0.12;
  const x = (i) => padL + (hours[i].h / 23) * iw;
  const y = (v) => padT + ih - ((v - min) / (max - min)) * ih;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('style', 'width:100%;height:auto;display:block');

  const add = (tag, attrs, titleText) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (titleText) {
      const t = document.createElementNS(NS, 'title');
      t.textContent = titleText;
      n.appendChild(t);
    }
    svg.appendChild(n);
    return n;
  };

  // suitability band backgrounds per hour (data colors)
  hours.forEach((hInfo, i) => {
    const bw = iw / 24;
    const col = hInfo.category === 'good' ? 'rgba(138,138,138,0.10)'
      : hInfo.category === 'caution' ? 'rgba(245,194,107,0.10)' : 'rgba(249,115,22,0.12)';
    add('rect', { x: padL + hInfo.h * bw, y: padT, width: bw, height: ih, fill: col });
  });

  // gridlines
  for (let g = 0; g <= 2; g++) {
    const gv = min + ((max - min) * g) / 2;
    add('line', { x1: padL, x2: w - padR, y1: y(gv), y2: y(gv), stroke: 'rgba(245,245,245,0.12)', 'stroke-width': 1 });
    const t = add('text', { x: padL - 4, y: y(gv) + 3.5, 'text-anchor': 'end', 'font-size': 9, fill: 'currentColor', opacity: 0.6 });
    t.textContent = `${Math.round(gv * 9 / 5 + 32)}°`;
  }

  // best-window highlight
  if (bt.best) {
    const x1 = padL + (bt.best.from / 24) * iw;
    const x2 = padL + ((bt.best.to + 1) / 24) * iw;
    add('rect', { x: x1, y: padT, width: Math.max(2, x2 - x1), height: ih, fill: 'none', stroke: 'rgba(245,245,245,0.55)', 'stroke-width': 1.2, rx: 3 },
      `Best window ${shortLabel(bt.best.from)}–${shortLabel(bt.best.to + 1)}`);
  }

  // hourly heat-index curve
  const pts = hours.map((hInfo, i) => `${x(i)},${y(hInfo.hiUsed)}`).join(' L');
  add('path', { d: `M${pts}`, fill: 'none', stroke: '#f5f5f5', 'stroke-width': 2, 'stroke-linecap': 'round' });

  // hour dots with tooltips
  hours.forEach((hInfo, i) => {
    add('circle', {
      cx: x(i), cy: y(hInfo.hiUsed), r: 2.6,
      fill: CAT_COLOR[hInfo.category] === '#8a8a8a' ? '#f5f5f5' : CAT_COLOR[hInfo.category],
    },
    `${hourLabel(hInfo.h)} — heat index ${hInfo.hiUsed != null ? tempF(hInfo.hiUsed, 1) : 'n/a'}${hInfo.temp != null ? ` · air ${tempF(hInfo.temp, 0)}` : ''}${hInfo.hum != null ? ` · RH ${Math.round(hInfo.hum)}%` : ''}`);
  });

  // NOW marker
  const nx = x(bt.nowIdx);
  add('line', { x1: nx, x2: nx, y1: padT, y2: padT + ih, stroke: '#f5f5f5', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.8 });
  const nt = add('text', { x: nx, y: padT - 3, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'currentColor', opacity: 0.85, 'font-weight': 700 });
  nt.textContent = 'NOW';

  // x labels every 6h
  [0, 6, 12, 18, 23].forEach((hLabel) => {
    const t = add('text', { x: x(hours.findIndex((z) => z.h === hLabel) >= 0 ? hours.findIndex((z) => z.h === hLabel) : 0), y: height - 7, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'currentColor', opacity: 0.6 });
    t.textContent = shortLabel(hLabel);
  });

  return svg;
}

function windowChip(label, win, cat) {
  if (!win) {
    return el('div', { class: 'glass-chip rounded-xl px-3 py-2 flex-1 min-w-[140px]' },
      el('p', { class: 'text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/70' }, label),
      el('p', { class: 'text-[12px] font-bold mt-0.5' }, 'None today'));
  }
  const color = cat === 'good' ? '#8a8a8a' : cat === 'caution' ? '#f5c26b' : '#f97316';
  return el('div', { class: 'glass-chip rounded-xl px-3 py-2 flex-1 min-w-[140px]' },
    el('p', { class: 'text-[9.5px] font-bold uppercase tracking-wider', style: { color } }, label),
    el('p', { class: 'text-[12.5px] font-black mt-0.5' }, `${shortLabel(win.from)} – ${shortLabel(win.to + 1)}`));
}

export function bestTimeCard(env, { compact = false } = {}) {
  const bt = computeBestTime(env);
  if (!bt) {
    return el('div', { class: 'glass-chip rounded-xl px-3 py-2.5 flex items-center gap-2 text-[12px] text-on-surface-variant/80' },
      icon('schedule', 'text-[16px] shrink-0'),
      'Best-time analysis needs the hourly environmental series — fetch environmental data for this location first.');
  }

  const srcBadge = el('span', { class: `source-badge ${bt.demo ? 'demo' : 'live'}` }, bt.demo ? 'Demo data' : 'Live · FortyGuard');

  if (compact) {
    return el('div', {},
      el('div', { class: 'flex items-center justify-between gap-sm mb-1.5' },
        el('span', { class: 'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/80' },
          icon('schedule', 'text-[15px]', false), 'Best time to go outside'),
        srcBadge),
      el('p', { class: 'text-[15px] font-black' },
        bt.best ? `${shortLabel(bt.best.from)} – ${shortLabel(bt.best.to + 1)}` : 'No suitable window today'),
      el('p', { class: 'text-[11px] text-on-surface-variant/85 mt-0.5' },
        bt.best
          ? `Heat index below ${tempF(GOOD_HI, 0)} · peak ${bt.peak ? tempF(bt.peak.hiUsed, 0) : '—'} at ${bt.peak ? shortLabel(bt.peak.h) : '—'}`
          : `Heat index stays at or above ${tempF(GOOD_HI, 0)} all day — limit outdoor exposure.`),
      el('div', { class: 'mt-2' }, bestTimeGraph(bt, { height: 92 })));
  }

  return el('div', { class: 'flex flex-col gap-sm' },
    el('div', { class: 'flex items-center justify-between gap-sm' },
      el('span', { class: 'flex items-center gap-1.5' },
        el('p', { class: 'text-[13px] font-black uppercase tracking-wide' }, 'Best Time to Go Outside'),
        srcBadge),
      el('span', { class: 'text-[10px] text-on-surface-variant/70 font-data-mono' }, 'heat-index based · operational guidance')),
    bestTimeGraph(bt),
    el('div', { class: 'flex flex-wrap gap-xs' },
      windowChip('Best window', bt.best, 'good'),
      windowChip('Caution', bt.caution, 'caution'),
      windowChip('High risk', bt.high, 'high')),
    el('div', { class: 'grid gap-xs md:grid-cols-2' },
      el('div', { class: 'glass-chip rounded-xl p-3' },
        el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5' }, 'Why this window'),
        el('ul', { class: 'flex flex-col gap-1 m-0 p-0 list-none' },
          whyLines(bt).map((l) => el('li', { class: 'text-[11.5px] text-on-surface-variant/90 flex gap-1.5' },
            el('span', { class: 'text-on-surface-variant/60 shrink-0' }, '•'), l)))),
      el('div', { class: 'glass-chip rounded-xl p-3' },
        el('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5' }, 'By activity'),
        el('div', { class: 'flex flex-col gap-1' },
          bt.activityWindows.map((a) => el('div', { class: 'flex items-center gap-2 text-[11.5px]' },
            icon(a.ic, 'text-[14px] text-on-surface-variant/80 shrink-0', false),
            el('span', { class: 'min-w-0 flex-1 truncate' }, a.label),
            a.window
              ? el('span', { class: 'font-bold' }, `${shortLabel(a.window.from)}–${shortLabel(a.window.to + 1)}`)
              : el('span', { class: 'font-bold text-thermal-mid' }, 'avoid midday')))))),
    el('p', { class: 'text-[10px] text-on-surface-variant/60 leading-snug' },
      'Suitability bands use the heat-index series from the environmental feed (good < 86°F, caution 86–91°F, high ≥ 92°F heat index). Operational guidance for planning — not medical advice.'));
}
