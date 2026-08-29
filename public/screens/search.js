// Global Command Search — full-page search over places + screens.

import { getState } from '../app/store.js';
import { geoSearch, loadContextFor } from '../app/api.js';
import { getPlaces } from '../app/placepick.js';
import { el, icon, pageHeader, card, emptyState, loadingState, sourceBadge, toast } from '../app/widgets.js';
import { navigate, ROUTES } from '../app/router.js';

let lastQuery = '';

export default {
  title: 'Global Search',
  async render(container) {
    container.appendChild(pageHeader({
      eyebrow: 'GLOBAL COMMAND',
      title: 'Global Search',
      subtitle: 'Find any Florida location or jump to a THERMA screen. Selecting a location updates the whole application.',
    }));

    const inputWrap = el('div', { class: 'glass-panel rounded-2xl flex items-center gap-3 px-md py-sm mb-md' },
      icon('search', 'text-[22px] opacity-60', false),
      el('input', {
        class: 'flex-1 bg-transparent outline-none text-[16px] font-semibold placeholder:text-on-surface-variant/50 min-w-0',
        placeholder: 'Search Miami neighborhoods, cities, addresses…',
        'aria-label': 'Search locations and screens',
        value: lastQuery,
      }),
      el('kbd', { class: 'hidden md:inline text-[10px] font-bold px-2 py-1 rounded-md bg-surface-container-highest/70 text-on-surface-variant' }, 'ESC to close'));

    const input = inputWrap.querySelector('input');
    const results = el('div', { class: 'flex-1 min-h-0 overflow-y-auto pb-lg', dataset: { searchResults: '' } });
    container.appendChild(inputWrap);
    container.appendChild(results);

    renderDefault(results);

    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      lastQuery = q;
      if (!q) { renderDefault(results); return; }
      timer = setTimeout(() => runSearch(q, results), 260);
    });
    setTimeout(() => input.focus(), 120);
  },
};

async function runSearch(q, host) {
  host.innerHTML = '';
  host.appendChild(loadingState(`Searching “${q}”…`));
  try {
    const [{ results: locs }] = await Promise.all([geoSearch(q)]);
    host.innerHTML = '';
    if (!locs.length) {
      host.appendChild(emptyState({
        ic: 'search_off', title: `No location matched “${q}”`,
        message: 'THERMA covers Florida. Try a neighborhood like “Wynwood” or a city like “Orlando”.',
      }));
      return;
    }
    host.appendChild(sectionLabel(`Locations (${locs.length})`));
    for (const p of locs) {
      host.appendChild(locationRow(p));
    }
  } catch (err) {
    host.innerHTML = '';
    host.appendChild(emptyState({ ic: 'cloud_off', title: 'Search unavailable', message: err.message || '' }));
  }
}

async function renderDefault(host) {
  host.innerHTML = '';
  host.appendChild(sectionLabel('Popular areas'));
  try {
    const places = await getPlaces();
    host.appendChild(el('div', { class: 'grid gap-xs mb-md', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' } },
      (places || []).slice(0, 12).map((p) => el('button', {
        class: 'squishy-btn glass-chip rounded-xl px-3 py-2 text-left hover-lift',
        onclick: () => selectLocation(p),
      },
      el('span', { class: 'block text-[12px] font-bold truncate' }, p.display),
      el('span', { class: 'block text-[10px] text-on-surface-variant/70 truncate' }, p.county || `${Number(p.lat).toFixed(2)}, ${Number(p.lon).toFixed(2)}`)))));
  } catch { /* ignore */ }

  host.appendChild(sectionLabel('Jump to screen'));
  host.appendChild(el('div', { class: 'grid gap-xs', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' } },
    Object.entries(ROUTES).map(([key, r]) => el('button', {
      class: 'squishy-btn glass-chip rounded-xl px-3 py-2 flex items-center gap-2 hover-lift',
      onclick: () => navigate(key),
    }, icon(r.icon, "text-[16px] text-on-surface-variant"), el('span', { class: 'text-[12px] font-bold truncate' }, r.title)))));

  host.appendChild(el('p', { class: 'text-[11px] text-on-surface-variant/70 mt-md' },
    'Tip: press Ctrl+K anywhere in THERMA to open the quick search modal.'));
}

function sectionLabel(text) {
  return el('p', { class: 'text-[10.5px] font-black uppercase tracking-[0.14em] text-on-surface-variant/60 mb-2 mt-1' }, text.toUpperCase());
}

function locationRow(p) {
  return el('button', {
    class: 'w-full glass-panel rounded-xl px-md py-sm mb-1.5 flex items-center gap-sm text-left hover-lift fade-up',
    onclick: () => selectLocation(p),
  },
  el('span', { class: 'w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0' },
    icon(p.external ? 'travel_explore' : 'location_on', 'text-[19px]', false)),
  el('span', { class: 'min-w-0 flex-1' },
    el('span', { class: 'block text-[13.5px] font-bold truncate' }, p.display),
    el('span', { class: 'block text-[11px] text-on-surface-variant/80 truncate' },
      `${Number(p.lat).toFixed(4)}, ${Number(p.lon).toFixed(4)}${p.type ? ' · ' + p.type : ''}${p.county ? ' · ' + p.county : ''}`)),
  p.external ? sourceBadge('demo', false) && null : null,
  icon('north_east', 'text-[15px] opacity-50 shrink-0', false));
}

async function selectLocation(p) {
  try {
    toast(`Loading ${p.display}…`);
    await loadContextFor(p.id);
    navigate('location', { param: p.id });
    toast(`Location set: ${p.display}`, 'success');
  } catch (err) {
    toast(err.message || 'Could not load that location.', 'error');
  }
}
