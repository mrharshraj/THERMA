// DOM + formatting helpers shared by all screens.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function icon(name, cls = '', fill = true) {
  return el('span', {
    class: `material-symbols-outlined ${cls}`,
    style: fill ? { fontVariationSettings: "'FILL' 1" } : {},
    'aria-hidden': 'true',
  }, name);
}

// ---------- formatters ----------

export const cToF = (c) => (c * 9) / 5 + 32;

export function tempF(c, digits = 0) {
  return c == null ? '—' : `${cToF(c).toFixed(digits)}°F`;
}
export function tempC(c, digits = 1) {
  return c == null ? '—' : `${Number(c).toFixed(digits)}°C`;
}
export function bothTemps(c) {
  return c == null ? '—' : `${tempF(c)} / ${tempC(c)}`;
}
export function km(meters) {
  return meters == null ? '—' : `${(meters / 1000).toFixed(1)} km`;
}
export function mins(seconds) {
  return seconds == null ? '—' : `${Math.round(seconds / 60)} min`;
}
export function pct(v, digits = 0) {
  return v == null ? '—' : `${Number(v).toFixed(digits)}%`;
}
export function num(v, digits = 0) {
  return v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function clockTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const SEVERITY_TONE = {
  Critical: { bg: 'rgba(185,28,28,.12)', color: '#b91c1c' },
  High: { bg: 'rgba(249,115,22,.14)', color: '#c2410c' },
  Medium: { bg: 'rgba(202,138,4,.14)', color: '#a16207' },
  Standard: { bg: 'rgba(43,125,233,.12)', color: '#1d63c4' },
  Low: { bg: 'rgba(43,125,233,.12)', color: '#1d63c4' },
};

export function severityChip(label) {
  const tone = SEVERITY_TONE[label] || SEVERITY_TONE.Low;
  return el('span', {
    class: 'inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full',
    style: { background: tone.bg, color: tone.color },
  }, el('span', { class: 'w-2 h-2 rounded-full', style: { background: tone.color }, 'aria-hidden': 'true' }), label);
}

export function bandChip(band, color, extraLabel) {
  if (!band) return el('span', { class: 'band-chip', style: { background: 'rgba(116,120,120,.12)' } }, 'Unknown');
  return el('span', { class: 'band-chip', style: { background: `${color}22`, borderColor: `${color}55` } },
    el('span', { class: 'band-dot', style: { background: color }, 'aria-hidden': 'true' }),
    extraLabel ? `${band} · ${extraLabel}` : band);
}

export function sourceBadge(source, demo) {
  const isDemo = demo === true || source === 'demo' || source === 'therma-demo';
  const b = el('span', { class: `source-badge ${isDemo ? 'demo' : source === 'therma-analysis' ? 'analysis' : 'live'}` });
  b.innerHTML = isDemo
    ? '<span class="material-symbols-outlined" style="font-size:11px;">science</span>Demo data'
    : source === 'therma-analysis'
      ? '<span class="material-symbols-outlined" style="font-size:11px;">functions</span>Therma analysis'
      : '<span class="material-symbols-outlined" style="font-size:11px;">verified</span>Live · FortyGuard';
  return b;
}

// ---------- structural widgets ----------

export function card({ title, subtitle, icon: ic, actions, children, pad = true, className = '' }) {
  const head = (title || actions) ? el('div', { class: 'flex items-start justify-between gap-sm px-md pt-md' + (pad ? '' : '') },
    el('div', { class: 'min-w-0 flex-1' },
      el('div', { class: 'flex items-center gap-2 min-w-0' },
        ic ? icon(ic, 'text-[18px] text-primary dark:text-inverse-primary shrink-0') : null,
        title ? el('h3', { class: 'text-label-md font-bold tracking-tight truncate min-w-0' }, title) : null,
        subtitle ? el('span', { class: 'text-[11px] text-on-surface-variant/80 truncate min-w-0' }, subtitle) : null)),
    actions ? el('div', { class: 'flex items-center gap-1 shrink-0' }, actions) : null) : null;
  return el('section', {
    class: `glass-panel rounded-2xl hover-lift min-w-0 ${className}`,
  }, head, el('div', { class: `card-body${pad ? ' p-md' : ''}` }, children));
}

export function statTile({ label, value, sub, ic, tone = '' }) {
  return el('div', { class: `glass-panel rounded-2xl p-md flex flex-col gap-1 hover-lift min-w-0 ${tone}` },
    el('div', { class: 'flex items-center justify-between gap-xs min-w-0' },
      el('span', { class: 'text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/75 truncate' }, label),
      ic ? icon(ic, 'text-[18px] text-on-surface-variant/70 shrink-0') : null),
    el('div', { class: 'kpi-value text-primary dark:text-inverse-primary', html: value }),
    sub ? el('div', { class: 'text-[11.5px] text-on-surface-variant/85 truncate', html: sub }) : null);
}

export function skeletonBlock(h = 'h-40', className = '') {
  return el('div', { class: `skeleton ${h} ${className}`, role: 'status', 'aria-label': 'Loading' });
}

export function loadingState(message, sub) {
  return el('div', { class: 'flex flex-col items-center justify-center gap-sm py-xl text-center' },
    el('div', { class: 'spinner text-primary dark:text-inverse-primary' }),
    el('p', { class: 'text-label-md font-semibold' }, message),
    sub ? el('p', { class: 'text-[12px] text-on-surface-variant/80 max-w-xs' }, sub) : null);
}

export function emptyState({ ic = 'inbox', title, message, actions }) {
  return el('div', { class: 'flex flex-col items-center justify-center gap-xs py-lg text-center px-md' },
    icon(ic, 'text-[36px] text-on-surface-variant/40'),
    el('p', { class: 'text-label-md font-bold' }, title),
    message ? el('p', { class: 'text-[12.5px] text-on-surface-variant/85 max-w-sm' }, message) : null,
    actions ? el('div', { class: 'flex flex-wrap gap-xs justify-center mt-xs' }, actions) : null);
}

export function errorState({ title = 'Something went wrong', message, err, retry, onDemo, onRelocate }) {
  const friendly = err && err.code ? friendlyError(err) : message;
  return el('div', { class: 'glass-panel rounded-2xl p-lg flex flex-col items-center gap-xs text-center', role: 'alert' },
    icon('cloud_off', 'text-[36px] text-on-surface-variant/50'),
    el('p', { class: 'text-label-md font-bold' }, title),
    el('p', { class: 'text-[12.5px] text-on-surface-variant/90 max-w-sm' }, friendly),
    el('div', { class: 'flex flex-wrap gap-xs justify-center mt-sm' },
      retry ? btnPrimary('Try Again', 'refresh', retry) : null,
      onRelocate ? btnGhost('Change Location', 'location_on', onRelocate) : null,
      onDemo ? btnGhost('Switch to Demo', 'science', onDemo) : null));
}

export function friendlyError(err) {
  const code = err && err.code;
  switch (code) {
    case 'HEAT_UNAVAILABLE': return 'Live heat intelligence is unavailable right now.';
    case 'LAYER_UNAVAILABLE': return 'This layer is unavailable for the selected area.';
    case 'ROUTE_UNAVAILABLE': return 'Route analysis is unavailable right now.';
    case 'NO_ROUTE': return 'No route could be found between the selected points.';
    case 'INVALID_LOCATION': return 'That location is not available in THERMA yet.';
    case 'PREMIUM_UNAVAILABLE': return err.message;
    case 'NETWORK': return 'Cannot reach the THERMA backend. Check your connection.';
    default: return err && err.message ? err.message : 'An unexpected error occurred.';
  }
}

// Report generation is the one flow where a bare "something went wrong" is not
// enough to act on, so the backend ships a stage + request id in development.
// Both are absent in production, where this degrades to the plain message.
export function diagnosticError(err, fallback = 'An unexpected error occurred.') {
  const msg = (err && err.message) || fallback;
  const bits = [];
  if (err && err.stage) bits.push(`Stage ${err.stage}`);
  if (err && err.requestId) bits.push(`Request ${err.requestId}`);
  return bits.length ? `${msg} (${bits.join(' · ')})` : msg;
}

export function btnPrimary(label, ic, onClick, extraClass = '') {
  const b = el('button', { class: `squishy-btn inline-flex items-center gap-1.5 bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface px-3.5 py-2 rounded-full text-[12.5px] font-bold ${extraClass}` },
    ic ? icon(ic, 'text-[16px]', false) : null, label);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function btnGhost(label, ic, onClick, extraClass = '') {
  const b = el('button', { class: `squishy-btn inline-flex items-center gap-1.5 border border-outline/40 text-on-surface dark:text-inverse-primary px-3.5 py-2 rounded-full text-[12.5px] font-bold hover:bg-surface-container/70 ${extraClass}` },
    ic ? icon(ic, 'text-[16px]', false) : null, label);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function pageHeader({ eyebrow, title, subtitle, actions, badge }) {
  return el('div', { class: 'flex flex-wrap items-end justify-between gap-sm mb-md' },
    el('div', { class: 'min-w-0' },
      eyebrow ? el('p', { class: 'text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70 mb-1' }, eyebrow) : null,
      el('div', { class: 'flex items-center gap-sm flex-wrap' },
        el('h1', { class: 'text-headline-lg font-headline-lg tracking-tight text-primary dark:text-inverse-primary' }, title),
        badge || null),
      subtitle ? el('p', { class: 'text-body-md text-on-surface-variant mt-1 max-w-2xl', html: subtitle }) : null),
    actions ? el('div', { class: 'flex flex-wrap items-center gap-xs' }, actions) : null);
}

// ---------- toasts ----------

export function toast(message, type = 'info') {
  const colors = {
    info: 'bg-inverse-surface text-inverse-on-surface',
    success: 'bg-green-700 text-white',
    warn: 'bg-orange-600 text-white',
    error: 'bg-red-700 text-white',
  };
  const icons = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' };
  const host = document.getElementById('toasts');
  const t = el('div', { class: `toast glass-panel rounded-xl px-md py-xs flex items-center gap-sm shadow-lg ${''}`, role: 'status' },
    icon(icons[type] || icons.info, `text-[18px] ${type === 'success' ? 'text-green-500' : type === 'warn' ? 'text-orange-400' : type === 'error' ? 'text-red-400' : 'text-blue-400'}`),
    el('span', { class: 'text-[13px] font-medium' }, message));
  host.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 300ms ease';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, 3400);
}
