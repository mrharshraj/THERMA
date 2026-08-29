// Bottom visualization workspace controller (auto-hiding docked panel).

import { el, icon, sourceBadge } from './widgets.js';

let hideTimer = null;
const AUTOHIDE_MS = 14000;

function root() {
  return document.getElementById('viz-workspace');
}

function scheduleHide(ms = AUTOHIDE_MS) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, ms);
}

export function show({ title = 'Analysis', iconName = 'insights', source = null, demo = null, build, sticky = false }) {
  const ws = root();
  if (!ws) return;
  document.getElementById('viz-icon').textContent = iconName;
  document.getElementById('viz-title').textContent = title;
  const badgeHost = document.getElementById('viz-source-badge');
  badgeHost.innerHTML = '';
  if (source || demo != null) badgeHost.appendChild(sourceBadge(source || 'therma-analysis', demo));

  const body = document.getElementById('viz-body');
  body.innerHTML = '';
  try {
    build(body);
  } catch (err) {
    console.error(err);
    body.appendChild(el('p', { class: 'text-[12px] text-error py-sm' }, 'Could not render this visualization.'));
  }

  ws.classList.remove('hidden');
  ws.classList.remove('fullscreen');
  requestAnimationFrame(() => ws.classList.add('shown'));
  ws.querySelector('.glass-panel').classList.remove('rounded-none');
  if (!sticky) scheduleHide();
  ws.onpointerdown = () => { if (!sticky) scheduleHide(); };
  ws.onpointermove = () => { if (!sticky) scheduleHide(AUTOHIDE_MS * 2); };
}

export function hide() {
  const ws = root();
  if (!ws || ws.classList.contains('hidden')) return;
  clearTimeout(hideTimer);
  ws.classList.remove('shown');
  setTimeout(() => {
    ws.classList.add('hidden');
    ws.classList.remove('expanded', 'fullscreen');
  }, 340);
}

export function isVisible() {
  const ws = root();
  return ws && !ws.classList.contains('hidden');
}

export function initVizWorkspace() {
  const ws = root();
  if (!ws || ws.dataset.bound) return;
  ws.dataset.bound = '1';
  document.getElementById('viz-close').addEventListener('click', hide);
  document.getElementById('viz-expand').addEventListener('click', () => {
    ws.classList.toggle('expanded');
    scheduleHide(AUTOHIDE_MS * 2);
  });
  document.getElementById('viz-fullscreen').addEventListener('click', () => {
    const going = !ws.classList.contains('fullscreen');
    ws.classList.toggle('fullscreen', going);
    document.getElementById('viz-body').style.maxHeight = going ? 'none' : '';
    window.dispatchEvent(new Event('resize'));
  });
  window.addEventListener('therma:navigated', () => hide());
}

// ---------- shared builders used by Zoe + screens ----------

export function splitPanels(panels) {
  // panels: [{title, node, grow}]
  const host = el('div', {
    class: 'grid gap-md',
    style: { gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 280px), ${panels.length > 1 ? '1fr' : '100%'}))` },
  });
  for (const p of panels.filter(Boolean)) {
    host.appendChild(el('div', { class: 'min-w-0' },
      p.title ? el('p', { class: 'text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5' }, p.title) : null,
      p.node));
  }
  return host;
}

export function kpiStrip(items) {
  return el('div', { class: 'flex flex-wrap gap-xs' }, items.map((i) =>
    el('div', { class: 'glass-chip rounded-xl px-3 py-2 min-w-[92px]' },
      el('p', { class: 'text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/70' }, i.label),
      el('p', { class: 'text-[15px] font-black leading-tight mt-0.5', html: i.value }),
      i.sub ? el('p', { class: 'text-[9.5px] text-on-surface-variant/80' }, i.sub) : null)));
}
