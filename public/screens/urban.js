// Urban & Property Intelligence (urban_property_intelligence).

import { getState } from '../app/store.js';
import { el, icon, pageHeader, card, emptyState, btnGhost, sourceBadge } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { assetCard, kpiStripForAssets, sortedByRisk, topExposureBars } from './_shared-assets.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

const PROPERTY_CATS = ['residential', 'retail', 'education', 'civic', 'recreation'];

export default {
  title: 'Urban & Property',
  async render(container) {
    const st = getState();
    const ctx = st.context;
    const all = ctx ? ctx.assets || [] : [];
    const properties = all.filter((a) => PROPERTY_CATS.includes(a.category));
    const list = properties.length ? properties : all;

    container.appendChild(pageHeader({
      eyebrow: 'URBAN INTELLIGENCE',
      title: 'Urban & Property',
      subtitle: ctx ? `Property-level heat intelligence across <b>${list.length} urban sites</b> — residences, retail, schools and civic assets.` : 'Property-level heat exposure.',
      badge: ctx ? modeBadgeFor(ctx) : null,
      actions: [
        placePicker(),
        btnGhost('Facilities View', 'factory', () => navigate('facilities')),
        btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Which property is most at risk?' }))),
      ],
    }));

    if (!ctx) {
      container.appendChild(emptyState({ ic: 'apartment', title: 'No urban context loaded', message: 'Select a location to evaluate its urban properties.' }));
      return;
    }

    container.appendChild(kpiStripForAssets(list));

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.3fr)]' });

    // left: property cards
    const left = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });
    left.appendChild(card({
      title: `Properties (${list.length})`, ic: 'apartment',
      subtitle: 'Sorted by heat risk index · THERMA analysis',
      children: el('div', { class: 'grid gap-2', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' } },
        sortedByRisk(list).map((a) => assetCard(a))),
    }));

    // right: map + hottest strip
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 min-h-0 lg:overflow-y-auto pr-1' });
    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[320px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute bottom-3 right-3 z-[500] rounded-full px-3 py-1.5' },
      sourceBadge(ctx.source === 'live' ? 'fortyguard' : 'demo', ctx.demo)));
    right.appendChild(mapWrap);

    right.appendChild(card({
      title: 'Priority Properties', ic: 'low_priority',
      subtitle: 'Highest exposure first',
      children: topExposureBars(list, 5) || emptyState({ ic: 'hourglass_empty', title: 'Awaiting heat layer' }),
    }));

    grid.appendChild(left);
    grid.appendChild(right);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      for (const a of list) {
        map.addMarker({
          lat: a.lat, lon: a.lon, label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
          category: a.category,
          color: a.risk && a.risk.index >= 4 ? '#b91c1c' : a.risk && a.risk.index === 3 ? '#f97316' : null,
          onClick: () => navigate('location', { param: `asset:${a.id}`, query: { view: 'property' } }),
        });
      }
      if (ctx.location) map.focusPlace(ctx.location);
    });

    screenEvent(window, 'therma:context', () => rerenderScreen('urban', container));
  },
};
