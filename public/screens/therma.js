// Therma — platform overview / about page with live capability status.

import { getState } from '../app/store.js';
import { getHealth } from '../app/api.js';
import { el, icon, pageHeader, card, btnPrimary, btnGhost, sourceBadge, loadingState } from '../app/widgets.js';
import { navigate } from '../app/router.js';

export default {
  title: 'Therma',
  async render(container) {
    container.appendChild(pageHeader({
      eyebrow: 'PLATFORM',
      title: 'Therma',
      subtitle: 'AI-powered urban heat intelligence for Florida — hyperlocal thermal mapping, exposure scoring and resilient routing in one operating console.',
      actions: [btnGhost('Open Decision Center', 'hub', () => navigate('workspace'))],
    }));

    // Hero
    container.appendChild(el('div', {
      class: 'glass-panel rounded-2xl p-lg mb-md relative overflow-hidden',
    },
    el('div', { class: 'absolute inset-0 opacity-[0.07] pointer-events-none thermal-scale' }),
    el('div', { class: 'relative' },
      el('img', { src: '/logo.png', alt: 'THERMA logo', class: 'w-14 h-14 object-contain rounded-xl bg-surface-container-lowest/60 p-1 mb-sm', onerror: (e) => e.currentTarget.remove() }),
      el('p', { class: 'text-[10.5px] font-black uppercase tracking-[0.16em] text-on-surface-variant mb-1' }, 'WHY THERMA EXISTS'),
      el('h2', { class: 'text-xl md:text-2xl font-black leading-tight max-w-2xl' },
        'Urban heat is measurable, mappable and mitigable — cities just need the right lens.'),
      el('p', { class: 'text-[13px] text-on-surface-variant/85 mt-sm max-w-2xl leading-relaxed' },
        'Therma fuses FortyGuard’s hyperlocal heat API with routing, asset portfolios and an AI operator (Zoe) so planners, facility managers and logistics teams can see heat exactly where people live, work and move — then act on it.'))));

    const st = getState();

    // Capability grid
    const caps = [
      ['device_thermostat', 'Hyperlocal Heat Maps', 'Cell-level surface temperature across Miami-Dade with persistence, exceedance and time-of-measure layers.', 'heat'],
      ['route', 'CoolRoute Engine', 'Origin–destination corridor analysis that scores routes by thermal exposure, not just minutes.', 'coolroute'],
      ['insights', 'Environmental Intelligence', 'Heat index, wet-bulb, humidity, air quality and solar load for any location.', 'environment'],
      ['apartment', 'Portfolio Lens', 'Every cataloged property, facility and infrastructure node ranked by thermal risk.', 'portfolio'],
      ['warning', 'Alert Rules', 'Automatic extreme-heat alerts with impact statements and recommended actions.', 'alerts'],
      ['description', 'Briefing Reports', 'One-click executive reports generated from the current location context.', 'reports'],
      ['smart_toy', 'Zoe, AI Operator', 'Natural-language control of the entire platform through a validated action set.', 'zoe'],
      ['hub', 'Decision Workspace', 'Understand → Compare → Prioritize → Act on a single triple-pane canvas.', 'workspace'],
    ];
    container.appendChild(el('div', { class: 'grid sm:grid-cols-2 xl:grid-cols-4 gap-md' },
      caps.map(([ic, title, desc, route]) => el('button', {
        class: 'glass-panel rounded-2xl p-md text-left hover-lift fade-up',
        onclick: () => navigate(route),
      },
      icon(ic, 'text-[22px] text-on-surface-variant'),
      el('p', { class: 'text-[13.5px] font-bold mt-2' }, title),
      el('p', { class: 'text-[11.5px] text-on-surface-variant/80 mt-1 leading-relaxed' }, desc),
      el('span', { class: 'inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant mt-2' }, 'OPEN', icon('arrow_forward', 'text-[12px]', false))))));

    // Live status strip
    const statusHost = el('div', { class: 'mt-md' }, card({
      title: 'Platform Status', ic: 'monitor_heart',
      children: loadingState('Reading backend health…'),
    }));
    container.appendChild(statusHost);
    fillStatus(statusHost);

    // Data & methodology note
    container.appendChild(card({
      title: 'Data & Methodology', ic: 'science',
      children: el('div', { class: 'text-[12px] text-on-surface-variant/85 leading-relaxed flex flex-col gap-2' },
        el('p', {}, 'Live mode queries the FortyGuard Heat API (surface temperature, activity layers) and OSRM-based routing. When the backend runs in demo mode, a captured Miami scenario replays deterministically so every screen remains fully explorable offline.'),
        el('p', {}, 'Exposure bands follow a fixed °F scale; scenario projections are linear what-if estimates, clearly labeled as such — not predictive simulations.'),
        el('div', { class: 'flex flex-wrap gap-xs mt-1' },
          sourceBadge(st.demoMode === false ? 'live' : 'demo', true),
          el('span', { class: 'glass-chip rounded-full px-2.5 py-1 text-[10.5px] font-bold' }, 'Miami-Dade focus'),
          el('span', { class: 'glass-chip rounded-full px-2.5 py-1 text-[10.5px] font-bold' }, 'v1.0'))),
    }));
  },
};

async function fillStatus(hostCard) {
  try {
    const h = await getHealth();
    const svcs = h.services || {};
    hostCard.replaceChildren(el('div', { class: 'grid sm:grid-cols-3 gap-xs' },
      svcTile('satellite_alt', 'FortyGuard Heat API', !!(svcs.fortyguard && svcs.fortyguard.available)),
      svcTile('auto_awesome', 'Gemini LLM', !!(svcs.gemini && svcs.gemini.available)),
      svcTile('route', `Routing · ${String(svcs.routing && svcs.routing.provider || 'osrm')}`, !!svcs.routing)));
  } catch {
    hostCard.replaceChildren(el('div', { class: 'glass-chip rounded-xl px-md py-sm flex items-center gap-2 text-red-500' },
      icon('cloud_off'), el('span', { class: 'text-[12.5px] font-bold' }, 'Backend unreachable')));
  }
}

function svcTile(icName, label, ok) {
  return el('div', { class: 'glass-chip rounded-xl px-md py-sm flex items-center gap-2' },
    icon(ok ? 'check_circle' : 'error_outline', `text-[17px] ${ok ? 'text-green-600' : 'text-amber-500'}`),
    el('span', {},
      el('span', { class: 'block text-[12px] font-bold' }, label),
      el('span', { class: 'block text-[10.5px] text-on-surface-variant/75' }, ok ? 'operational' : 'fallback active')));
}
