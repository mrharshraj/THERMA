// Decision Workspace — map + graph + flowchart + context + recommendation.
// Matches Stitch command_decision_center visual structure.

import { getState, setState } from '../app/store.js';
import { getContext } from '../app/api.js';
import { getPlaces } from '../app/placepick.js';
import { el, icon, pageHeader, card, statTile, emptyState, btnPrimary, btnGhost, bandChip, sourceBadge, tempF, loadingState } from '../app/widgets.js';
import * as map from '../app/map.js';
import { distributionArea, barChart } from '../app/charts.js';
import { riskChain, flowchart } from '../app/flowchart.js';
import { navigate } from '../app/router.js';

export default {
  title: 'Decision Workspace',
  layout: 'fixed',   // viewport-locked workspace; one internal scroll region at lg+
  async render(container, route) {
    const st = getState();
    const ctx = st.context;
    const mode = (route.query && route.query.mode) || 'split';

    // Fixed-workspace wrapper: at lg+ this is the single intentional scroll
    // region; below lg it is plain flow and the page scrolls naturally.
    const wrap = el('div', { class: 'flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1' });
    container.appendChild(wrap);
    const screen = wrap;

    // ---------- Command Input Header (Stitch command_decision_center) ----------
    const header = el('div', { class: 'flex flex-col gap-md max-w-4xl mx-auto w-full pt-2 pb-md text-center' },
      el('p', { class: 'text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant' }, 'COMMAND & DECISION CENTER'),
      el('h1', { class: 'font-display-lg text-display-lg text-primary tracking-tight' }, 'WHAT DO YOU WANT TO UNDERSTAND?'),
      el('div', { class: 'relative w-full group max-w-2xl mx-auto' },
        el('div', { class: 'absolute -inset-0.5 bg-gradient-to-r from-primary-container/20 to-tertiary-container/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500' }),
        el('input', {
          class: 'relative w-full bg-surface-container-lowest border-none rounded-2xl py-4 px-6 pr-14 text-on-surface shadow-[inset_0_2px_8px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/20 transition-all font-body-lg text-body-lg placeholder:text-on-surface-variant/50 outline-none text-left',
          value: ctx ? `Analyze heat risk in ${ctx.location.display}` : 'Find the highest heat-risk area in Miami',
          'aria-label': 'Decision Command Query',
          onkeydown: (e) => {
            if (e.key === 'Enter') {
              window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: e.target.value }));
            }
          },
        }),
        el('button', {
          class: 'absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface flex items-center justify-center squishy-btn shadow-md',
          title: 'Ask Zoe', 'aria-label': 'Submit Query',
          onclick: (e) => {
            const val = e.currentTarget.parentElement.querySelector('input').value;
            window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: val }));
          },
        }, icon('search', 'text-[20px]', false))));
    screen.appendChild(header);

    if (!ctx) {
      screen.appendChild(emptyState({ ic: 'psychology', title: 'No decision context', message: 'Load heat intelligence first — every panel here is driven by live data.' }));
      return;
    }

    const hm = ctx.heatmap || {};
    const stats = hm.stats || {};
    const ranked = (ctx.assets || []).filter((a) => a.risk).sort((a, b) => b.risk.index - a.risk.index);

    // ---------- KPI Strip ----------
    screen.appendChild(el('div', { class: 'grid gap-xs mb-md', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' } },
      statTile({ label: 'Mean Surface', value: tempF(stats.mean), sub: `${stats.n ?? 0} cells`, ic: 'device_thermostat' }),
      statTile({ label: 'Exposure Score', value: ctx.exposure ? String(ctx.exposure.score) : '—', sub: ctx.exposure ? ctx.exposure.level : '', ic: 'speed' }),
      statTile({ label: 'Top Priority', value: ranked[0] ? `${Math.round(ranked[0].tempF)}°F` : '—', sub: ranked[0] ? ranked[0].name : '—', ic: 'priority_high' }),
      statTile({ label: 'Alerts', value: String((ctx.alerts || []).length), sub: 'active now', ic: 'notification_important' })));

    // ---------- Bento Grid Workspace (lg:grid-cols-12) ----------
    const bento = el('div', { class: 'grid grid-cols-1 lg:grid-cols-12 gap-lg w-full max-w-[1400px] mx-auto pb-md' });

    // --- LEFT PANEL (lg:col-span-4): Resolution Path / Flowchart ---
    const leftPanel = el('div', { class: 'lg:col-span-4 glass-panel rounded-2xl p-lg flex flex-col gap-md' },
      el('div', { class: 'flex items-center gap-2 mb-xs' },
        icon('account_tree', 'text-primary dark:text-inverse-primary text-[22px]', false),
        el('h2', { class: 'font-headline-md text-headline-md text-primary dark:text-inverse-primary font-bold' }, 'Resolution Path')),
      el('div', { class: 'flex flex-col gap-sm flex-1' },
        riskChain(ctx.exposure)));
    bento.appendChild(leftPanel);

    // --- RIGHT PANEL (lg:col-span-8): Map Canvas & Thermal Correlation Chart ---
    const rightPanel = el('div', { class: 'lg:col-span-8 flex flex-col gap-lg' });

    // Map Canvas Container
    const mapWrap = el('div', { class: 'relative h-[380px] md:h-[460px] rounded-2xl overflow-hidden glass-panel group bg-surface-container-low' });
    const mapCtrls = el('div', { class: 'absolute top-4 right-4 flex flex-col gap-2 z-[500]' },
      mapCtrl('add', 'Zoom In', () => map.zoomBy(1)),
      mapCtrl('remove', 'Zoom Out', () => map.zoomBy(-1)),
      mapCtrl('fit_screen', 'Fit Area', () => map.focusPlace(ctx.location)),
      mapCtrl('fullscreen', 'Fullscreen', () => map.toggleFullscreen(mapWrap)));
    mapWrap.appendChild(mapCtrls);

    // Thermal Legend Overlay
    const mapLegend = el('div', { class: 'absolute bottom-4 left-4 bg-surface/90 dark:bg-inverse-surface/90 backdrop-blur-xl border border-outline-variant/30 rounded-xl p-3 shadow-md flex flex-col gap-2 min-w-[200px] z-[500]' },
      el('div', { class: 'flex justify-between items-center' },
        el('span', { class: 'font-label-sm text-[10px] text-on-surface dark:text-inverse-on-surface font-bold uppercase tracking-wide' }, 'Heat Index'),
        icon('info', 'text-on-surface-variant text-xs', false)),
      el('div', { class: 'thermal-scale h-3 w-full rounded-full shadow-inner' }),
      el('div', { class: 'flex justify-between font-label-sm text-[10px] text-on-surface-variant uppercase font-bold' },
        el('span', {}, 'Optimal'), el('span', {}, 'Danger')));
    mapWrap.appendChild(mapLegend);

    rightPanel.appendChild(mapWrap);

    // Bottom Graph / Thermal Load Details Panel
    const chartPanel = card({
      title: 'Thermal Load & Stress Correlation', ic: 'bar_chart',
      subtitle: `${ctx.location.display} FortyGuard thermal distribution`,
      actions: [
        btnGhost('Export Data', 'download', () => {
          const blob = new Blob([JSON.stringify(ctx, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `therma-decision-${ctx.location.id}.json`; a.click();
        }),
      ],
      children: el('div', { class: 'flex flex-col gap-md pt-xs' },
        hm.distribution && hm.distribution.frequency
          ? distributionArea({ axis: hm.distribution.frequency.axis, counts: hm.distribution.frequency.counts })
          : emptyState({ ic: 'no_sim', title: 'No histogram data available' }),
        ranked.length ? barChart({
          items: ranked.slice(0, 6).map((a) => ({ label: a.name, value: Math.round(a.tempF), color: a.risk.index >= 4 ? '#b91c1c' : '#f97316' })),
          fmt: (v) => `${v}°F`,
        }) : null),
    });
    rightPanel.appendChild(chartPanel);

    bento.appendChild(rightPanel);
    screen.appendChild(bento);

    // ---------- Compare / Prioritize / Act Row ----------
    const actionRow = el('div', { class: 'grid gap-md mb-md', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))' } });
    actionRow.appendChild(compareCard(mode));
    actionRow.appendChild(prioritizeCard(ranked));
    actionRow.appendChild(actCard());
    screen.appendChild(actionRow);

    // Mount Leaflet Map
    requestAnimationFrame(async () => {
      map.mount(mapWrap);
      try {
        const { loadGridLayer } = await import('../app/api.js');
        const payload = await loadGridLayer(st.place.id, 'temperature');
        map.drawGrid((payload.grid || []).filter((t) => t.value != null).map((t) => ({ ...t, units: payload.units })), { opacity: 0.55 });
      } catch {
        map.drawGrid(((hm.grid) || []).filter((t) => t.value != null), { opacity: 0.55 });
      }
      map.focusPlace(ctx.location);
      for (const a of (ctx.assets || []).slice(0, 25)) {
        map.addMarker({
          lat: a.lat, lon: a.lon, label: `${a.name}${a.tempF != null ? ' · ' + Math.round(a.tempF) + '°F' : ''}`,
          category: a.category,
          color: a.risk && a.risk.index >= 4 ? '#b91c1c' : null,
          onClick: () => navigate('location', { param: `asset:${a.id}` }),
        });
      }
    });
  },
};

function mapCtrl(icName, title, onClick) {
  return el('button', {
    class: 'map-ctrl', title, 'aria-label': title,
    onclick: onClick,
  }, icon(icName, 'text-[18px]', false));
}

function compareCard(mode) {
  const host = card({
    title: 'COMPARE', ic: 'compare_arrows',
    subtitle: mode === 'comparison' ? 'Comparison focus selected by Zoe' : 'Benchmark against another Florida area',
    children: el('div', {}),
  });
  const body = host.querySelector('.card-body');
  body.className = 'p-md flex flex-col gap-xs';
  buildCompareUI(body);
  return host;
}

async function buildCompareUI(body) {
  body.appendChild(loadingState('Loading area index…'));
  try {
    const places = await getPlaces();
    body.innerHTML = '';
    const select = el('select', { class: 'field-input !py-2 text-[12.5px]', 'aria-label': 'Comparison area' },
      places.slice(0, 30).map((p) => el('option', { value: p.id }, p.display)));
    const resultHost = el('div', {});
    const btn = btnPrimary('Compare', 'balance', async () => {
      resultHost.innerHTML = '';
      resultHost.appendChild(loadingState('Fetching comparison data…'));
      try {
        const other = await getContext(select.value);
        resultHost.innerHTML = '';
        resultHost.appendChild(compareResult(other));
      } catch (err) {
        resultHost.innerHTML = '';
        resultHost.appendChild(emptyState({ ic: 'error', title: 'Comparison unavailable', message: err.message || '' }));
      }
    });
    body.appendChild(select);
    body.appendChild(btn);
    body.appendChild(resultHost);
  } catch {
    body.innerHTML = '';
    body.appendChild(emptyState({ ic: 'error', title: 'Place index unavailable' }));
  }
}

function compareResult(other) {
  const cur = getState().context;
  const s1 = cur.heatmap.stats, s2 = other.heatmap.stats;
  const dMean = (s2.mean - s1.mean) * 9 / 5;
  return el('div', { class: 'flex flex-col gap-sm mt-2 fade-up' },
    el('div', { class: 'grid grid-cols-3 gap-xs text-center' },
      cmpCell(cur.location.display, tempF(s1.mean), 'current mean'),
      cmpCell('Δ', `${dMean >= 0 ? '+' : ''}${dMean.toFixed(1)}°F`, Math.abs(dMean) < 1 ? 'similar' : dMean > 0 ? 'other is hotter' : 'other is cooler'),
      cmpCell(other.location.display, tempF(s2.mean), 'other mean')),
    el('div', { class: 'text-[11px] text-on-surface-variant/85 leading-snug' },
      `Current area exposure: ${cur.exposure ? cur.exposure.level : 'n/a'} (${cur.exposure ? cur.exposure.score : '—'}). Comparison area: ${other.exposure ? other.exposure.level : 'n/a'} (${other.exposure ? other.exposure.score : '—'}). ${(other.alerts || []).length} vs ${(cur.alerts || []).length} active alerts.`));
}

function cmpCell(title, big, sub) {
  return el('div', { class: 'glass-chip rounded-xl py-2 px-2' },
    el('p', { class: 'text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70 truncate' }, title),
    el('p', { class: 'text-[15px] font-black leading-tight mt-0.5' }, big),
    el('p', { class: 'text-[9.5px] text-on-surface-variant/80' }, sub));
}

function prioritizeCard(ranked) {
  return card({
    title: 'PRIORITIZE', ic: 'low_priority',
    subtitle: 'Ranked by sustained exposure · THERMA analysis',
    children: ranked.length
      ? el('ol', { class: 'flex flex-col gap-1.5 list-none m-0 p-0' },
        ranked.slice(0, 4).map((a, i) => el('li', {},
          el('button', {
            class: 'w-full flex items-center gap-2.5 glass-chip rounded-xl px-3 py-2 hover-lift',
            onclick: () => navigate('location', { param: `asset:${a.id}` }),
          },
          el('span', { class: `w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${i === 0 ? 'bg-red-700 text-white' : 'bg-surface-container-highest dark:bg-surface-container'}` }, String(i + 1)),
          el('span', { class: 'min-w-0 flex-1 text-left' },
            el('span', { class: 'block text-[12px] font-bold truncate' }, a.name),
            el('span', { class: 'block text-[9.5px] uppercase tracking-wider font-bold text-on-surface-variant/65' }, a.category)),
          el('span', { class: 'shrink-0' }, bandChip(a.risk.band, a.risk.index >= 4 ? '#b91c1c' : '#f97316'))))))
      : emptyState({ ic: 'hourglass_empty', title: 'Load heat data to rank assets' }),
  });
}

function actCard() {
  return card({
    title: 'ACT', ic: 'task_alt',
    subtitle: 'Recommended next moves from current context',
    children: (() => {
      const recs = (getState().context.recommendations || []).slice(0, 2);
      return el('div', { class: 'flex flex-col gap-2' },
        recs.length ? recs.map((r) => el('div', { class: 'glass-chip rounded-xl p-2.5' },
          el('div', { class: 'flex items-center justify-between mb-0.5' },
            el('span', { class: 'text-[12px] font-bold' }, r.title),
            el('span', { class: 'text-[9.5px] font-black uppercase tracking-wider text-on-surface-variant/60' }, r.priority)),
          el('p', { class: 'text-[11px] text-on-surface-variant/90 leading-snug' }, r.detail)))
          : el('p', { class: 'text-[12px] text-on-surface-variant/85' }, 'Conditions are stable — no urgent actions recommended.'),
        el('div', { class: 'flex flex-wrap gap-xs mt-1 pt-2 border-t border-outline-variant/20 dark:border-outline/10' },
          btnPrimary('Generate Report', 'description', () => window.dispatchEvent(new CustomEvent('therma:zoe-send', { detail: 'Generate a report' }))),
          btnGhost('Plan CoolRoute', 'route', () => navigate('coolroute')),
          btnGhost('View Alerts', 'notifications', () => navigate('alerts'))));
    })(),
  });
}

