// Scenario Simulation — transparent what-if arithmetic over the current
// heat layer. Clearly labeled THERMA SCENARIO ESTIMATE; no invented model.

import { getState, setState } from '../app/store.js';
import { el, icon, pageHeader, card, statTile, emptyState, btnPrimary, btnGhost, bandChip, sourceBadge, tempF } from '../app/widgets.js';
import * as map from '../app/map.js';
import { placePicker } from '../app/placepick.js';
import { screenEvent, rerenderScreen } from '../app/router.js';
import { columnChart, barChart } from '../app/charts.js';
import { flowchart } from '../app/flowchart.js';

const INTERVENTIONS = [
  { id: 'cool_roof', label: 'Cool Roofs', ic: 'roofing', maxDropC: 1.6, note: 'High-albedo roofing reduces local surface peaks.' },
  { id: 'shade', label: 'Shade Structures', ic: 'umbrella', maxDropC: 1.1, note: 'Canopy coverage lowers pedestrian-level exposure.' },
  { id: 'pavement', label: 'Reflective Pavement', ic: 'edit_road', maxDropC: 1.3, note: 'Higher-albedo pavement cuts stored heat.' },
  { id: 'vegetation', label: 'Tree Canopy', ic: 'park', maxDropC: 2.0, note: 'Evapotranspiration plus shading — strongest but slowest lever.' },
];

let scenario = { intervention: 'cool_roof', coveragePct: 40 };

// Current what-if state for Zoe's application context (read-only view).
export function getScenario() {
  const iv = INTERVENTIONS.find((i) => i.id === scenario.intervention);
  return { intervention: scenario.intervention, label: iv ? iv.label : scenario.intervention, coveragePct: scenario.coveragePct };
}

export default {
  title: 'Scenario Simulation',
  async render(container) {
    const st = getState();
    const ctx = st.context;

    container.appendChild(pageHeader({
      eyebrow: 'WHAT-IF ANALYSIS',
      title: 'Scenario Simulation',
      subtitle: `Arithmetic what-if scenarios applied to the <b>current</b> FortyGuard layer for ${ctx ? `<b>${ctx.location.display}</b>` : 'the selected area'}. Outputs are labeled <b>THERMA SCENARIO ESTIMATE</b> — not forecasts or sensor data.`,
      badge: ctx ? (ctx.demo ? sourceBadge('demo', true) : sourceBadge('fortyguard', false)) : null,
      actions: [placePicker(), btnGhost('Ask Zoe', 'smart_toy', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Prepare a cooling scenario' })))]
      ,
    }));

    if (!ctx || !ctx.heatmap) {
      container.appendChild(emptyState({
        ic: 'science', title: 'No baseline heat data',
        message: 'Scenarios apply to a loaded heat layer. Load the heat intelligence for a location first.',
        actions: [btnGhost('Open Heat Intelligence', 'local_fire_department', () => import('../app/router.js').then((r) => r.navigate('heat')))],
      }));
      return;
    }

    const hm = ctx.heatmap;
    const baseMean = hm.stats.mean;

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.35fr)]' });

    // ---------- left: controls ----------
    const left = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    const interventionCards = el('div', { class: 'grid grid-cols-2 gap-xs' },
      INTERVENTIONS.map((iv) => {
        const active = scenario.intervention === iv.id;
        return el('button', {
          class: `squishy-btn rounded-xl p-2.5 text-left ${active ? 'bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface' : 'glass-chip hover:bg-surface-container/70'}`,
          dataset: { scenBtn: iv.id },
          onclick: () => { scenario.intervention = iv.id; rerenderControls(); updateProjection(); },
        },
        el('span', { class: 'flex items-center gap-1.5 text-[11.5px] font-bold' }, icon(iv.ic, 'text-[15px]', false), iv.label),
        el('span', { class: `block text-[9.5px] mt-1 leading-snug ${active ? 'opacity-75' : 'text-on-surface-variant/70'}` }, iv.note),
        el('span', { class: 'block text-[10px] font-black mt-1.5' }, `up to −${(iv.maxDropC * 9 / 5).toFixed(1)}°F`));
      }));

    const sliderWrap = el('div', {},
      el('div', { class: 'flex items-center justify-between mb-1' },
        el('label', { class: 'text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70' }, 'Coverage'),
        el('span', { class: 'text-[12px] font-black', dataset: { covLabel: '' } }, `${scenario.coveragePct}%`)),
      el('input', {
        type: 'range', min: '5', max: '100', step: '5', value: String(scenario.coveragePct),
        class: 'w-full', 'aria-label': 'Scenario coverage percentage',
        oninput: (e) => {
          scenario.coveragePct = Number(e.target.value);
          const lbl = sliderWrap.querySelector('[data-cov-label]');
          if (lbl) lbl.textContent = `${scenario.coveragePct}%`;
          updateProjection();
        },
      }));

    left.appendChild(card({ title: 'Intervention', ic: 'construction', children: interventionCards }));
    left.appendChild(card({ title: 'Deployment Coverage', ic: 'tune', subtitle: 'Share of treated area within the analysis zone', children: sliderWrap }));

    left.appendChild(card({
      title: 'Assumptions Chain', ic: 'account_tree',
      children: flowchart({
        steps: [
          { title: 'CURRENT LAYER', detail: `Baseline mean ${(baseMean * 9 / 5 + 32).toFixed(1)}°F from FortyGuard cells.`, icon: 'layers', tone: 'data', tag: 'current data' },
          { title: 'INTERVENTION', detail: `${INTERVENTIONS.find((i) => i.id === scenario.intervention).label} at ${scenario.coveragePct}% coverage.`, icon: 'construction', tone: 'assumption', tag: 'assumption' },
          { title: 'LINEAR OFFSET', detail: 'Uniform reduction scaled by coverage share.', icon: 'linear_scale', tone: 'method', tag: 'method' },
          { title: 'SCENARIO OUTPUT', detail: 'Projected mean clearly labeled as estimate.', icon: 'query_stats', tone: 'output', tag: 'scenario estimate' },
        ],
      }),
    }));

    grid.appendChild(left);

    // ---------- right: projection ----------
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    right.appendChild(el('div', {
      class: 'glass-panel rounded-2xl p-3 flex items-center gap-sm mb-0',
    }, icon('science', 'text-[18px] text-on-surface-variant'),
    el('p', { class: 'text-[11.5px] font-semibold' }, 'All projected values below are THERMA SCENARIO ESTIMATES derived by simple linear offsets from current FortyGuard data — not predictive modeling.')));

    const projectionHost = el('div', { class: 'flex flex-col gap-md', dataset: { projection: '' } });
    right.appendChild(projectionHost);

    const mapWrap = el('div', { class: 'relative rounded-2xl overflow-hidden border border-outline-variant/25 dark:border-outline/15 min-h-[260px] bg-surface-container-low' });
    mapWrap.appendChild(el('div', { class: 'glass-panel absolute top-3 left-3 z-[500] rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider' }, 'Current layer · baseline view'));
    right.appendChild(mapWrap);

    grid.appendChild(right);
    container.appendChild(grid);

    requestAnimationFrame(() => {
      map.mount(mapWrap);
      drawBaseline();
    });

    // Zoe's create_scenario action focuses this workspace; data refreshes
    // update the screen in place.
    screenEvent(window, 'therma:new-scenario', () => {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      import('../app/widgets.js').then(({ toast }) => toast('Scenario workspace ready — pick an intervention.', 'success'));
    });
    screenEvent(window, 'therma:context', () => rerenderScreen('scenarios', container));

    function rerenderControls() {
      document.querySelectorAll('[data-scen-btn]').forEach((b) => {
        const active = b.dataset.scenBtn === scenario.intervention;
        b.className = `squishy-btn rounded-xl p-2.5 text-left ${active ? 'bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface' : 'glass-chip hover:bg-surface-container/70'}`;
        const note = b.children[1];
        if (note) note.className = `block text-[9.5px] mt-1 leading-snug ${active ? 'opacity-75' : 'text-on-surface-variant/70'}`;
      });
    }

    function updateProjection() {
      const host = projectionHost;
      host.innerHTML = '';
      host.appendChild(buildProjection(baseMean));
    }
    updateProjection();
  },
};

function buildProjection(baseMeanC) {
  const iv = INTERVENTIONS.find((i) => i.id === scenario.intervention);
  const dropC = iv.maxDropC * (scenario.coveragePct / 100);
  const projMeanC = Math.max(20, baseMeanC - dropC);
  const deltaF = (baseMeanC - projMeanC) * 9 / 5;
  const stats = getState().context.heatmap.stats;
  const projMaxC = stats.max != null ? Math.max(projMeanC, stats.max - dropC) : null;
  const projMinC = stats.min != null ? Math.max(18, stats.min - dropC) : null;

  return el('div', { class: 'flex flex-col gap-md fade-up' },
    el('div', { class: 'grid gap-xs', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' } },
      statTile({ label: 'Baseline Mean', value: tempF(baseMeanC), sub: 'current FortyGuard layer', ic: 'layers' }),
      statTile({ label: 'Projected Mean', value: tempF(projMeanC), sub: `−${deltaF.toFixed(1)}°F vs baseline`, ic: 'trending_down' }),
      statTile({ label: 'Projected Peak', value: projMaxC != null ? tempF(projMaxC) : '—', sub: 'scaled peak estimate', ic: 'north' }),
      statTile({ label: 'Cooling Effect', value: `${Math.round((dropC / iv.maxDropC) * 100)}%`, sub: `of max potential −${(iv.maxDropC * 9 / 5).toFixed(1)}°F`, ic: 'bolt' })),
    card({
      title: 'Baseline vs Scenario', ic: 'compare_arrows',
      subtitle: 'THERMA SCENARIO ESTIMATE — linear offset method',
      children: columnChart({
        items: [
          { label: 'Min', value: projMinC != null ? +(projMinC * 9 / 5 + 32).toFixed(1) : 0, color: '#57b1ff' },
          { label: 'Mean now', value: +(baseMeanC * 9 / 5 + 32).toFixed(1), color: '#f97316' },
          { label: 'Mean scen.', value: +(projMeanC * 9 / 5 + 32).toFixed(1), color: '#059669' },
          ...(projMaxC != null ? [{ label: 'Peak now', value: +(stats.max * 9 / 5 + 32).toFixed(1), color: '#b91c1c' }] : []),
          ...(projMaxC != null ? [{ label: 'Peak scen.', value: +(projMaxC * 9 / 5 + 32).toFixed(1), color: '#ea580c' }] : []),
        ],
        yFmt: (v) => `${Math.round(v)}°F`,
        height: 210,
      }),
    }),
    exposureShiftCard(baseMeanC, projMeanC));
}

function exposureShiftCard(baseMeanC, projMeanC) {
  const bandOf = (c) => (c >= 35 ? ['Extreme', '#b91c1c'] : c >= 32 ? ['Hot', '#f97316'] : c >= 30 ? ['Warm', '#fed7aa'] : c >= 28 ? ['Mild', '#57b1ff'] : ['Cool', '#2b7de9']);
  const [bBand, bColor] = bandOf(baseMeanC);
  const [pBand, pColor] = bandOf(projMeanC);
  return card({
    title: 'Exposure Band Shift', ic: 'moving',
    children: el('div', { class: 'flex items-center justify-center gap-md flex-wrap py-sm' },
      bandChip(bBand, bColor, 'current mean'),
      icon('arrow_forward', 'text-[20px] opacity-50', false),
      bandChip(pBand, pColor, 'projected mean'),
      el('span', { class: 'text-[11px] text-on-surface-variant/80 w-full text-center mt-1' },
        `A shift of ${bBand !== pBand ? 'one band represents roughly 1.8–3.6°F of sustained relief across the area.' : 'no band change — consider higher coverage for measurable relief.'}`)),
  });
}

async function drawBaseline() {
  const ctx = getState().context;
  if (!ctx || !ctx.location) return;
  try {
    const { loadGridLayer } = await import('../app/api.js');
    const payload = await loadGridLayer(ctx.location.id, 'temperature');
    map.drawGrid((payload.grid || []).filter((t) => t.value != null).map((t) => ({ ...t, units: payload.units })), { opacity: 0.55 });
    map.focusPlace(ctx.location);
  } catch {
    map.drawGrid(((ctx.heatmap && ctx.heatmap.grid) || []).filter((t) => t.value != null), { opacity: 0.55 });
    map.focusPlace(ctx.location);
  }
}
