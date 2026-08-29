// Shared global-location picker used across screens.
// Dropdown: curated Florida places (searchable) + recents + browser location +
// custom coordinates — every entry resolves through the existing geo services
// and updates the global context.

import { getState, setState } from './store.js';
import { loadContextFor, geoPlaces, geoReverse } from './api.js';
import { el, icon, sourceBadge, toast } from './widgets.js';
import * as map from './map.js';

let placesCache = null;

export async function getPlaces() {
  if (!placesCache) {
    try {
      const res = await geoPlaces();
      placesCache = res.results || [];
    } catch {
      placesCache = [];
    }
  }
  return placesCache;
}

export function currentPlaceLabel() {
  const st = getState();
  return (st.context && st.context.location && st.context.location.display)
    || (st.place && st.place.display)
    || 'Select location';
}

// ---- recents (persisted locally, capped) ----------------------------------
function getRecents() {
  try { return JSON.parse(localStorage.getItem('therma.recents') || '[]'); } catch { return []; }
}
function pushRecent(placeLike) {
  try {
    const entry = {
      id: placeLike.id,
      display: placeLike.display || placeLike.name || placeLike.id,
      lat: placeLike.lat, lon: placeLike.lon,
    };
    if (!entry.id) return;
    const list = [entry, ...getRecents().filter((r) => r.id !== entry.id)].slice(0, 4);
    localStorage.setItem('therma.recents', JSON.stringify(list));
  } catch { /* ignore */ }
}

// details/summary dropdown; selecting a place reloads global context.
export function placePicker({ dark = false } = {}) {
  const labelEl = el('span', { class: 'truncate max-w-[180px] font-bold' }, currentPlaceLabel());
  const summary = el('summary', {
    class: 'list-none cursor-pointer squishy-btn inline-flex items-center gap-2 glass-chip rounded-full pl-3 pr-2 py-1.5',
    role: 'button',
    'aria-haspopup': 'listbox',
  },
  icon('location_on', 'text-[17px] text-on-surface-variant'),
  labelEl,
  icon('expand_more', 'text-[16px] opacity-60', false));

  const searchInput = el('input', {
    class: 'field-input !py-1.5 !text-[12px] mb-1.5',
    placeholder: 'Search places…',
    'aria-label': 'Search places',
  });

  const listEl = el('div', { class: 'max-h-80 overflow-y-auto flex flex-col gap-0.5', role: 'listbox' });

  const menu = el('div', {
    class: 'hidden absolute right-0 mt-2 w-80 z-40 glass-panel rounded-2xl p-sm fade-up',
  }, searchInput, listEl);

  const root = el('details', { class: 'relative' }, summary, menu);

  const row = (opts) => el('button', {
    class: `w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-surface-container/90 ${opts.active ? 'bg-primary-container/60 dark:bg-surface-container' : ''}`,
    role: 'option',
    onclick: opts.onclick,
  },
  icon(opts.ic || 'location_on', `text-[15px] ${opts.icClass || 'text-on-surface-variant/70'} shrink-0`, false),
  el('span', { class: 'min-w-0 flex-1' },
    el('span', { class: 'block text-[12.5px] font-bold truncate' }, opts.title),
    opts.sub ? el('span', { class: 'block text-[10px] text-on-surface-variant/75 truncate' }, opts.sub) : null),
  opts.trailing || null);

  const choose = async (placeLike) => {
    root.open = false;
    menu.classList.add('hidden');
    const ok = await selectPlace(placeLike);
    if (ok) pushRecent(placeLike);
  };

  // ---- custom coordinates form (revealed by the "Custom coordinates" row) ----
  const latInput = el('input', { class: 'field-input !py-1.5 !text-[12px]', type: 'number', step: 'any', placeholder: 'Latitude (25.77)', 'aria-label': 'Custom latitude' });
  const lonInput = el('input', { class: 'field-input !py-1.5 !text-[12px]', type: 'number', step: 'any', placeholder: 'Longitude (-80.19)', 'aria-label': 'Custom longitude' });
  let customOpen = false;
  const customForm = el('div', { class: 'hidden flex-col gap-1.5 px-1 pb-1' },
    latInput, lonInput,
    el('button', {
      class: 'squishy-btn bg-primary text-on-primary rounded-full px-3 py-1.5 text-[11.5px] font-bold self-start',
      onclick: () => {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          choose({ id: `${lat},${lon}`, display: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon });
        } else {
          toast('Enter a valid latitude/longitude pair.', 'warn');
        }
      },
    }, 'Use coordinates'));
  const customRow = row({
    ic: 'edit_location_alt', title: 'Custom coordinates…', sub: 'lat, lon pair anywhere in Florida',
    onclick: () => {
      customOpen = !customOpen;
      customForm.classList.toggle('hidden', !customOpen);
      customForm.classList.toggle('flex', customOpen);
    },
  });

  const useMyLocationRow = row({
    ic: 'my_location', title: 'Use my location', sub: 'browser geolocation',
    icClass: 'text-on-surface-variant/70',
    onclick: async () => {
      if (!navigator.geolocation) {
        toast('Geolocation is not available in this browser.', 'warn');
        return;
      }
      toast('Locating you…');
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        let display = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        try {
          const rev = await geoReverse(lat, lon);
          if (rev && rev.label) display = rev.label.split(',').slice(0, 2).join(', ');
        } catch { /* keep coordinate label */ }
        choose({ id: `${lat},${lon}`, display, lat, lon });
      }, () => toast('Location permission denied — pick a place instead.', 'warn'), { timeout: 8000 });
    },
  });

  let loaded = false;
  root.addEventListener('toggle', async () => {
    menu.classList.toggle('hidden', !root.open);
    if (!root.open || loaded) return;
    loaded = true;
    const places = await getPlaces();
    const render = () => {
      const q = searchInput.value.trim().toLowerCase();
      listEl.innerHTML = '';
      const recents = getRecents();
      if (!q && recents.length) {
        listEl.appendChild(el('p', { class: 'px-3 pt-1 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, 'Recent'));
        for (const r of recents) {
          listEl.appendChild(row({
            title: r.display, sub: 'recent', ic: 'history',
            active: currentPlaceLabel() === r.display,
            onclick: () => choose(r),
          }));
        }
      }
      if (!q) {
        listEl.appendChild(el('p', { class: 'px-3 pt-1.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-on-surface-variant/60' }, 'Florida places'));
      }
      const filtered = places.filter((p) => !q || `${p.name} ${p.display} ${p.county || ''}`.toLowerCase().includes(q));
      for (const p of filtered.slice(0, 30)) {
        listEl.appendChild(row({
          title: p.display, sub: p.county || '',
          active: currentPlaceLabel() === p.display,
          onclick: () => choose(p),
        }));
      }
      if (!filtered.length) {
        listEl.appendChild(el('p', { class: 'px-3 py-3 text-[12px] text-on-surface-variant/80' },
          'No match. Use Custom coordinates below or Global Search (Ctrl+K).'));
      }
      listEl.appendChild(useMyLocationRow);
      listEl.appendChild(customRow);
      listEl.appendChild(customForm);
    };
    searchInput.oninput = render;
    render();
  });

  return root;
}

export async function selectPlace(p) {
  try {
    toast(`Loading ${p.display || p.id}…`);
    const ctx = await loadContextFor(p.id);
    map.clearHighlight();
    map.focusPlace(ctx.location);
    setState({ gridLayer: 'temperature' });
    return true;
  } catch (err) {
    toast(err.message || 'Could not switch location.', 'error');
    return false;
  }
}

// Demo-mode toggle wired to backend ?demo= param semantics. The forced mode is
// persisted locally so a reload keeps the user's LIVE/DEMO choice instead of
// silently falling back to the server default (a forced-live session must
// never quietly show demo numbers again).
export function setDemoMode(v) {
  setState({ demoMode: v, context: null, layerCache: {}, routes: null, environment: null });
  try {
    if (v === true) localStorage.setItem('therma.demoMode', 'demo');
    else if (v === false) localStorage.setItem('therma.demoMode', 'live');
    else localStorage.removeItem('therma.demoMode');
  } catch { /* ignore */ }
  const st = getState();
  if (st.place) loadContextFor(st.place.id).catch(() => {});
}

export function loadPersistedDemoMode() {
  try {
    const v = localStorage.getItem('therma.demoMode');
    if (v === 'demo') setState({ demoMode: true });
    else if (v === 'live') setState({ demoMode: false });
  } catch { /* ignore */ }
}

export function modeBadgeFor(context) {
  if (!context) return null;
  return sourceBadge(context.source === 'live' ? 'fortyguard' : 'demo', context.demo);
}
