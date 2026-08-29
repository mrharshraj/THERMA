// Shell navigation: desktop sidebar, mobile drawer + bottom nav, badges.

import { getState, setState, subscribe } from './store.js';
import { ROUTES, GROUP_LABELS, navigate, current } from './router.js';
import { el, icon } from './widgets.js';
import { getSelectedRole, primaryNavFor, completeNav } from './roles.js';

const BOTTOM_NAV = ['overview', 'heat', 'coolroute', 'alerts'];

// Exact Stitch nav-link classes (ui/*/code.html <aside><nav>). markActive() swaps
// between IDLE and ACTIVE wholesale — Stitch's active row carries no hover: classes,
// so it must not keep them.
const NAV_BASE = 'nav-item relative flex items-center px-gutter py-2 group transition-all';
const NAV_IDLE = 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface';
const NAV_ACTIVE = 'active bg-secondary-container text-on-secondary-container font-semibold shadow-inner';
const NAV_ICON = 'mr-3 text-[20px] opacity-70 group-hover:opacity-100 shrink-0';
const GROUP_H3 = 'nav-group-label px-gutter mb-2 text-[10px] font-bold uppercase tracking-widest text-outline font-data-mono';

function navClass(active) {
  return `${NAV_BASE} ${active ? NAV_ACTIVE : NAV_IDLE}`;
}

export function isActive(name) {
  const cur = current();
  return cur ? cur.name === name : false;
}

function navItem(name) {
  const meta = ROUTES[name];
  const active = isActive(name);
  const item = el('button', {
    class: navClass(active),
    dataset: { nav: name },
    title: meta.label,
    'aria-label': meta.title,
    'aria-current': active ? 'page' : null,
    onclick: () => {
      navigate(name);
      closeDrawer();
    },
  });
  item.appendChild(icon(meta.icon, NAV_ICON, false));
  item.appendChild(el('span', { class: 'nav-label truncate' }, meta.label));
  if (name === 'alerts') {
    const n = getState().context ? getState().context.alerts.length : 0;
    if (n > 0) item.appendChild(el('span', { class: 'nav-badge bg-error text-on-primary' }, String(n)));
  }
  return item;
}

// Stitch groups are <section><h3/><div class="space-y-1">…links…</div></section>,
// and the <nav>'s space-y-8 spaces the sections.
function navSection(label, names) {
  const list = el('div', { class: 'space-y-1' });
  names.forEach((n) => list.appendChild(navItem(n)));
  return el('section', {}, el('h3', { class: GROUP_H3 }, label), list);
}

export function buildSidebarNav() {
  const nav = document.getElementById('sidebar-nav');
  const footer = document.getElementById('sidebar-footer');
  if (!nav) return;
  nav.innerHTML = '';
  footer.innerHTML = '';

  // NOTE: a "Dark" row used to sit in this sidebar calling cycleTheme().
  // THERMA is dark-only — no light palette, no theme switching — so the row
  // was a dead control. Do not reintroduce a theme toggle or appearance pref.

  // "All Tools" is a ROLE/access profile (judges, demos), never navigation:
  // it must not appear as a sidebar item for any role. Normal roles get their
  // compact prioritized navigation; the 'all' profile gets the complete
  // platform navigation. One sidebar component, metadata-driven.
  const roleId = getSelectedRole();
  const primary = primaryNavFor(roleId);

  if (primary) {
    for (const section of primary) {
      nav.appendChild(navSection(section.label, section.screens));
    }
    // Reporting & System anchors the footer so Settings stays reachable for
    // every role (Change Role lives there).
    footer.appendChild(navSection('System', ['settings']));
  } else {
    const sections = completeNav();
    for (const section of sections) {
      if (section.id === 'reporting') continue;
      nav.appendChild(navSection(section.label, section.screens));
    }
    const reporting = sections.find((s) => s.id === 'reporting');
    if (reporting) footer.appendChild(navSection(reporting.label, reporting.screens));
  }

  markActive();
}

export function markActive() {
  document.querySelectorAll('[data-nav]').forEach((b) => {
    const active = isActive(b.dataset.nav);
    b.className = navClass(active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const bottom = document.getElementById('mobile-bottomnav');
  if (bottom) {
    bottom.querySelectorAll('[data-bnav]').forEach((b) => {
      b.classList.toggle('active', isActive(b.dataset.bnav));
    });
  }
}

export function buildBottomNav() {
  const host = document.getElementById('mobile-bottomnav');
  if (!host) return;
  host.innerHTML = '';
  BOTTOM_NAV.forEach((name) => {
    const meta = ROUTES[name];
    const b = el('button', {
      class: `bottom-nav-item ${isActive(name) ? 'active' : ''}`,
      dataset: { bnav: name },
      onclick: () => navigate(name),
      'aria-label': meta.label,
    });
    b.appendChild(icon(meta.icon, 'text-[22px]', false));
    b.appendChild(el('span', {}, meta.label.split(' ')[0]));
    host.appendChild(b);
  });
  const more = el('button', {
    class: 'bottom-nav-item',
    'aria-label': 'All screens',
    onclick: () => openDrawer(),
  }, icon('menu', 'text-[22px]', false), el('span', {}, 'More'));
  host.appendChild(more);
}

// ---------------- drawer ----------------

export function openDrawer() {
  const sb = document.getElementById('sidebar');
  const scrim = document.getElementById('drawer-scrim');
  sb.classList.add('fixed', 'inset-y-0', 'left-0', 'flex', 'z-50', 'shadow-2xl');
  sb.classList.remove('hidden');
  scrim.classList.remove('hidden');
  requestAnimationFrame(() => { sb.style.transform = 'translateX(0)'; });
}

export function closeDrawer() {
  const sb = document.getElementById('sidebar');
  const scrim = document.getElementById('drawer-scrim');
  if (!sb.classList.contains('fixed')) return;
  sb.style.transform = 'translateX(-105%)';
  scrim.classList.add('hidden');
  setTimeout(() => {
    sb.classList.remove('fixed', 'inset-y-0', 'left-0', 'flex', 'z-50', 'shadow-2xl');
    sb.classList.add('hidden');
    sb.style.transform = '';
  }, 260);
}

// ---------------- collapse ----------------

export function initCollapse() {
  let collapsed = false;
  try { collapsed = localStorage.getItem('therma.sidebar') === 'collapsed'; } catch { /* ignore */ }
  applyCollapsed(collapsed);
  const btn = document.getElementById('sidebar-collapse-btn');
  btn.addEventListener('click', () => {
    applyCollapsed(!document.getElementById('sidebar').classList.contains('collapsed'));
  });
}

function applyCollapsed(collapsed) {
  const sb = document.getElementById('sidebar');
  const label = document.querySelector('#sidebar-collapse-btn .collapse-label');
  sb.classList.toggle('collapsed', collapsed);
  // The rail width is a single custom property on #app (--rail-width). Flipping it
  // here keeps the sidebar and #content's left offset in lockstep — otherwise the
  // rail narrows to 72px and the content column keeps a 240px gutter.
  const app = document.getElementById('app');
  if (app) app.classList.toggle('rail-collapsed', collapsed);
  setState({ sidebarCollapsed: collapsed });
  if (label) label.textContent = collapsed ? 'Expand View' : 'Focus View';
  const ic = document.querySelector('#sidebar-collapse-btn .material-symbols-outlined');
  if (ic) ic.textContent = collapsed ? 'close_fullscreen' : 'open_in_full';
  try { localStorage.setItem('therma.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ }
  // The rail animates over 300ms; let Leaflet re-measure after the transition ends
  // as well as immediately, so maps never keep a stale viewport width.
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
}

// ---------------- boot ----------------

export function initShellNav() {
  buildSidebarNav();
  buildBottomNav();
  initCollapse();

  document.getElementById('mobile-menu-btn').addEventListener('click', openDrawer);
  document.getElementById('drawer-scrim').addEventListener('click', closeDrawer);

  subscribe((state, keys) => {
    if (keys.includes('context')) {
      buildSidebarNav();
      buildBottomNav();
    }
  });

  // Role changes re-prioritize the ONE sidebar in place — no remount, no
  // duplicate navigation. Navigation also rebuilds it so the All Tools group
  // auto-expands when the active screen sits outside the primary set.
  window.addEventListener('therma:role', () => buildSidebarNav());
  window.addEventListener('therma:navigated', () => buildSidebarNav());

  window.addEventListener('therma:navigated', markActive);
}
