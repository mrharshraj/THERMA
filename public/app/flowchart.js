// SVG flowchart renderer (foreignObject nodes + SVG connectors).
// Premium monochrome: node hierarchy comes from surface elevation, border
// weight and typography — never from hue. Tokens live in styles.css (--flow-*);
// the hex fallbacks below mirror them for standalone contexts.

import { el } from './widgets.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Grayscale node treatments (spec: data vs assumption vs method vs output).
//   data       — measured input (CURRENT DATA / FORTYGUARD): light border, white title
//   assumption — user-supplied premise: slightly darker surface, gray border
//   method     — THERMA derivation step: neutral dark surface, gray border
//   output     — resulting estimate / action: elevated surface, white border
//   neutral    — untyped step: same as method
const TONES = {
  data: {
    bg: 'var(--flow-node-bg, #111111)',
    border: 'var(--flow-border-strong, #e5e5e5)',
    borderW: 1.5,
    title: '#ffffff',
  },
  assumption: {
    bg: 'var(--flow-node-bg-dim, #0e0e0e)',
    border: 'var(--flow-border, #2a2a2a)',
    borderW: 1,
    title: 'var(--flow-title, #f5f5f5)',
  },
  method: {
    bg: 'var(--flow-node-bg, #111111)',
    border: 'var(--flow-border, #2a2a2a)',
    borderW: 1,
    title: 'var(--flow-title, #f5f5f5)',
  },
  output: {
    bg: 'var(--flow-node-bg-elevated, #171717)',
    border: 'var(--flow-border-strong, #e5e5e5)',
    borderW: 1.5,
    title: '#ffffff',
  },
};

function toneOf(step) {
  return TONES[step.tone] || TONES.method;
}

// steps: [{title, detail, icon, tone, tag}]
export function flowchart({ steps, width = 520 }) {
  if (!steps || !steps.length) {
    return el('div', { class: 'text-[12px] text-on-surface-variant/70 py-lg text-center' }, 'No reasoning chain available.');
  }
  const nodeGap = 34;
  const nodeH = 64;
  const h = steps.length * nodeH + (steps.length - 1) * nodeGap + 8;
  // height="auto" is invalid as an SVG geometry attribute (length-only); use CSS instead.
  const s = svgEl('svg', { viewBox: `0 0 ${width} ${h}`, role: 'img', style: 'width:100%;height:auto;display:block' });

  steps.forEach((st, i) => {
    const y = i * (nodeH + nodeGap) + 4;
    const t = toneOf(st);

    const fo = svgEl('foreignObject', { x: 14, y, width: width - 28, height: nodeH });
    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.style.cssText = `
      height:${nodeH}px; box-sizing:border-box; display:flex; align-items:center; gap:12px;
      background:${t.bg}; border:${t.borderW}px solid ${t.border}; border-radius:16px; padding:8px 14px;
      font-family:'Inter',sans-serif; color:var(--flow-detail, #a3a3a3);
    `;
    div.innerHTML = `
      <span style="width:34px;height:34px;border-radius:12px;background:var(--flow-icon-bg, rgba(245,245,245,0.08));border:1px solid var(--flow-icon-border, rgba(245,245,245,0.16));display:flex;align-items:center;justify-content:center;flex:none;">
        <span class="material-symbols-outlined" style="font-size:19px;color:var(--flow-icon, #e5e5e5);font-variation-settings:'FILL' 1;">${st.icon || 'bolt'}</span>
      </span>
      <span style="min-width:0;">
        <span style="display:block;font-size:13px;font-weight:800;color:${t.title};">${st.title}</span>
        ${st.detail ? `<span style="display:block;font-size:11px;color:var(--flow-detail, #a3a3a3);margin-top:2px;">${st.detail}</span>` : ''}
        ${st.tag ? `<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:var(--flow-badge-bg, rgba(245,245,245,0.06));color:var(--flow-badge-text, #a3a3a3);border:1px solid var(--flow-badge-border, rgba(245,245,245,0.14));border-radius:999px;padding:1px 8px;margin-top:4px;">${st.tag}</span>` : ''}
      </span>`;
    fo.appendChild(div);
    s.appendChild(fo);

    if (i < steps.length - 1) {
      const x1 = width / 2;
      const y1 = y + nodeH + 3;
      const y2 = y1 + nodeGap - 6;
      s.appendChild(svgEl('line', { x1, y1, x2: x1, y2: y2 - 7, stroke: 'var(--flow-connector, #a3a3a3)', 'stroke-width': 2, opacity: 0.8 }));
      s.appendChild(svgEl('path', {
        d: `M ${x1 - 6} ${y2 - 8} L ${x1} ${y2} L ${x1 + 6} ${y2 - 8} Z`,
        fill: 'var(--flow-connector, #a3a3a3)', opacity: 0.9,
      }));
    }
  });
  return el('div', { class: 'flowchart-root w-full' }, s);
}

// Preset chain used across the app: measured heat data flows through THERMA
// analysis to a ranked action. Grayscale tones carry the data → analysis →
// action hierarchy; the tags carry the semantics.
export function riskChain(exposure) {
  const level = exposure ? exposure.level : null;
  const drivers = exposure && exposure.drivers && exposure.drivers.length ? exposure.drivers.join(', ') : 'baseline thermal conditions';
  return flowchart({
    steps: [
      { title: 'HEAT', detail: 'FortyGuard hyperlocal temperature layer for the selected area.', icon: 'local_fire_department', tone: 'data', tag: 'fortyguard data' },
      { title: 'EXPOSURE', detail: `THERMA exposure score ${exposure ? exposure.score : '—'} · mean surface ${exposure && exposure.temperature != null ? (exposure.temperature * 9 / 5 + 32).toFixed(1) + '°F' : 'n/a'}.`, icon: 'thermostat', tone: 'method', tag: 'therma analysis' },
      { title: 'RISK', detail: `${level || 'Elevated'} risk — driven by ${drivers}.`, icon: 'warning', tone: 'method', tag: level ? level.toUpperCase() : '' },
      { title: 'PRIORITY', detail: 'Assets and zones ranked by sustained exposure bands.', icon: 'low_priority', tone: 'method', tag: 'ranking' },
      { title: 'ACTION', detail: 'Mitigations staged as recommendations, alerts, and reports.', icon: 'task_alt', tone: 'output', tag: 'act' },
    ],
  });
}
