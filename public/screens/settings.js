// Settings — theme, data mode, service status, local data reset.

import { getState, setState } from '../app/store.js';
import { getHealth, getFortyGuardStatus } from '../app/api.js';
import { initTheme } from '../app/theme.js';
import { setDemoMode } from '../app/placepick.js';
import { el, icon, pageHeader, card, sourceBadge, btnPrimary, btnGhost, toast, loadingState } from '../app/widgets.js';
import { getSelectedRole, roleById } from '../app/roles.js';
import { navigate } from '../app/router.js';

export default {
  title: 'Settings',
  async render(container) {
    const st = getState();

    container.appendChild(pageHeader({
      eyebrow: 'SYSTEM',
      title: 'Settings',
      subtitle: 'Appearance, data mode and platform diagnostics. Preferences persist locally on this device.',
    }));

    const grid = el('div', { class: 'grid lg:grid-cols-2 gap-md' });

    // ---- Appearance: THERMA is DARK-ONLY. There is no theme switch, selector or
    // light palette — the low-glare dark surface IS the product. This card states
    // that; it is never a toggle. Do not reintroduce Light/System options here.
    grid.appendChild(card({
      title: 'Appearance', ic: 'palette',
      children: el('div', { class: 'flex items-center gap-sm px-md py-sm rounded-xl bg-primary/10 ring-1 ring-primary/40' },
        icon('dark_mode', 'text-[20px] opacity-80'),
        el('span', { class: 'min-w-0' },
          el('span', { class: 'block text-[13px] font-bold' }, 'Dark'),
          el('span', { class: 'block text-[11px] text-on-surface-variant/75' }, 'THERMA ships a single control-room dark palette. There is no light mode.')),
        icon('check_circle', 'text-[18px] text-green-600 ml-auto')),
    }));

    // ---- Workflow role (personalization only — every screen stays available)
    const activeRole = roleById(getSelectedRole());
    grid.appendChild(card({
      title: 'Workflow Role', ic: 'account_circle',
      subtitle: 'Personalizes sidebar order, Overview priorities and Zoe emphasis.',
      children: el('div', { class: 'flex items-center gap-sm px-md py-sm rounded-xl bg-surface-container-high/50' },
        icon(activeRole ? activeRole.icon : 'help_outline', 'text-[20px] opacity-80'),
        el('span', { class: 'min-w-0' },
          el('span', { class: 'block text-[13px] font-bold' }, activeRole ? activeRole.name : 'No role selected'),
          el('span', { class: 'block text-[11px] text-on-surface-variant/75' }, activeRole ? activeRole.desc : 'Choose how you use THERMA to prioritize your workspace.')),
        el('span', { class: 'ml-auto shrink-0' },
          btnGhost('Change Role', 'swap_horiz', () => navigate('role')))),
    }));

    // ---- Data mode
    grid.appendChild(card({
      title: 'Data Mode', ic: 'swap_horiz',
      subtitle: 'Demo replays a captured Miami scenario; Live queries FortyGuard in real time.',
      children: el('div', { class: 'flex flex-col gap-1' },
        [[null, 'tune', 'Follow server default', 'Use the mode configured on the backend'],
         [true, 'science', 'Force demo data', 'Deterministic offline scenario — no API credits used'],
         [false, 'satellite_alt', 'Force live data', 'Real-time thermal intelligence (consumes credits)']].map(([val, ic, label, desc]) => {
          const active = st.demoMode === val;
          return el('button', {
            class: `flex items-center gap-sm px-md py-sm rounded-xl text-left transition-colors ${active ? 'bg-primary/10 dark:bg-inverse-primary/10 ring-1 ring-primary/40' : 'hover:bg-surface-container-high/60'}`,
            onclick: async () => {
              try { await setDemoMode(val); toast(`Data mode updated.`, 'success'); rerender(container); }
              catch (err) { toast(err.message || 'Could not switch mode.', 'error'); }
            },
          },
          icon(ic, 'text-[20px] opacity-80'),
          el('span', { class: 'min-w-0' },
            el('span', { class: 'block text-[13px] font-bold' }, label),
            el('span', { class: 'block text-[11px] text-on-surface-variant/75' }, desc)),
          active ? icon('check_circle', 'text-[18px] text-green-600 ml-auto') : null);
        })),
    }));

    container.appendChild(grid);

    // ---- Service status (live)
    const statusCard = card({
      title: 'Service Status', ic: 'monitor_heart',
      subtitle: 'Live diagnostics from the THERMA backend',
      children: loadingState('Checking services…'),
    });
    container.appendChild(el('div', { class: 'mt-md' }, statusCard));
    refreshStatus(statusCard);

    // ---- Local data
    container.appendChild(card({
      title: 'Local Data & Privacy', ic: 'lock',
      children: el('div', { class: 'text-[12px] text-on-surface-variant/85 leading-relaxed flex flex-col gap-2' },
        el('p', {}, 'THERMA stores only UI preferences on this device (sidebar state). Reports generated in your session live in sessionStorage and disappear when the tab closes.'),
        el('div', { class: 'flex flex-wrap gap-xs mt-1' },
          btnGhost('Clear cached layers', 'layers_clear', () => {
            try { sessionStorage.removeItem('therma.reports'); } catch { /* ignore */ }
            location.reload();
          }),
          btnGhost('Reset preferences', 'restart_alt', () => {
            try { localStorage.removeItem('therma.sidebar'); } catch { /* ignore */ }
            initTheme();
            toast('Preferences reset.', 'success');
            rerender(container);
          }))),
    }));
  },
};

async function refreshStatus(host) {
  try {
    const health = await getHealth();
    let fg = null;
    try { fg = await getFortyGuardStatus(); } catch { /* optional */ }
    host.replaceChildren(...statusRows(health, fg));
  } catch (err) {
    host.replaceChildren(el('div', { class: 'glass-chip rounded-xl px-md py-sm flex items-center gap-2 text-red-500' },
      icon('cloud_off'), el('span', { class: 'text-[12.5px] font-bold' }, `Backend unreachable — ${err.message || 'network error'}`)));
  }
}

function statusRow(icName, label, value, ok) {
  return el('div', { class: 'flex items-center gap-sm px-md py-sm rounded-xl bg-surface-container-high/50 min-w-0' },
    icon(icName, `text-[19px] ${ok ? 'text-green-600' : 'text-on-surface-variant/60'} shrink-0`),
    el('span', { class: 'text-[12.5px] font-bold truncate' }, label),
    el('span', { class: 'ml-auto text-[11.5px] text-on-surface-variant/85 text-right max-w-[55%] truncate min-w-0' }, value));
}

function statusRows(health, fg) {
  const rows = [];
  rows.push(statusRow('dns', 'Backend API', `${health.name || 'therma-backend'} · online`, true));
  const svcs = health.services || {};
  rows.push(statusRow('satellite_alt', 'FortyGuard heat engine',
    svcs.fortyguard && svcs.fortyguard.available ? 'available' : 'unavailable — demo fallback active',
    !!(svcs.fortyguard && svcs.fortyguard.available)));
  if (fg && fg.remainingCredits != null) {
    rows.push(statusRow('payments', 'API credits remaining', numFmt(fg.remainingCredits), fg.remainingCredits > 0));
  }
  rows.push(statusRow('auto_awesome', 'Gemini (Zoe LLM)',
    svcs.gemini && svcs.gemini.available ? 'connected' : 'not configured — local reasoning engine active',
    !!(svcs.gemini && svcs.gemini.available)));
  rows.push(statusRow('route', 'Routing provider', String(svcs.routing && svcs.routing.provider || 'osrm-demo'), !!svcs.routing));
  rows.push(statusRow('toggle_on', 'Default data mode', health.demoDefault ? 'demo' : 'live', true));
  return rows;
}

function numFmt(n) { return Number(n).toLocaleString(); }

function rerender(container) {
  const parent = container.parentNode;
  if (!parent) return;
  import('../app/router.js').then((m) => m.resolve({ name: 'settings', param: '', query: {} }, container));
}
