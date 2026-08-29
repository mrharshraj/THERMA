// Reports Library — real server-generated reports (reports_library_2).

import { getState } from '../app/store.js';
import { generateReport, reportUrl } from '../app/api.js';
import { el, icon, pageHeader, card, emptyState, btnPrimary, btnGhost, toast, clockTime, diagnosticError } from '../app/widgets.js';
import { stashedReports, stashReport } from '../app/zoe.js';
import { navigate } from '../app/router.js';
// The analysis-window selection is shared with Zoe, so it lives in its own
// module (see app/reportwindow.js). This screen owns the UI for it.
import { WINDOW_PRESETS, hhmm, parseHour, windowSel, resolveWindow, windowPayload } from '../app/reportwindow.js';

export default {
  title: 'Reports Library',
  async render(container) {
    const st = getState();
    const openId = st._routeQuery && st._routeQuery.open;

    container.appendChild(pageHeader({
      eyebrow: 'DOCUMENT INTELLIGENCE',
      title: 'Reports Library',
      subtitle: 'Generate complete heat-intelligence briefings from the live application context. Reports open in a new tab and are printable to PDF.',
      badge: st.context ? (st.context.demo ? el('span', { class: 'source-badge demo' }, 'Demo data') : el('span', { class: 'source-badge live' }, 'Live · FortyGuard')) : null,
      actions: [
        btnPrimary('Generate Report', 'description', () => generate()),
      ],
    }));

    if (!st.context) {
      container.appendChild(emptyState({ ic: 'description', title: 'No context yet', message: 'Reports compile the current location’s heat layer, environment, assets and alerts.' }));
      return;
    }

    container.appendChild(windowCard());

    const listCard = card({
      title: 'Session Reports', ic: 'library_books',
      subtitle: 'Stored for this browser session',
      children: el('div', { dataset: { reportList: '' } }, renderList()),
    });
    container.appendChild(listCard);

    container.appendChild(card({
      title: 'Report Contents', ic: 'checklist',
      children: el('div', { class: 'grid gap-xs text-[12px] text-on-surface-variant/90', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' } },
        ['Spatial + windowed heat statistics (min / mean / max, cell counts)',
          'Temperature, heat index, humidity and wet-bulb charts',
          'Environmental parameters snapshot',
          'Asset risk table with bands',
          'Active alerts with impacts and actions',
          'Prioritized recommendations'].map((t) =>
          el('div', { class: 'flex items-center gap-2 glass-chip rounded-xl px-3 py-2' }, icon('check_circle', 'text-[15px] text-green-600'), t))),
    }));

    // Open the requested report once per id (repeat navigations with a
    // different id still open).
    if (openId) {
      if (!window.__thermaOpenedReports) window.__thermaOpenedReports = {};
      if (!window.__thermaOpenedReports[openId]) {
        window.__thermaOpenedReports[openId] = true;
        window.open(reportUrl(openId), '_blank', 'noopener');
      }
    }

    function windowCard() {
      const presetSelect = el('select', {
        class: 'field-input !py-2 text-[12.5px]',
        'aria-label': 'Report analysis window',
        dataset: { windowPreset: '' },
        onchange: (e) => { windowSel.preset = e.target.value; syncWindowUi(); },
      }, WINDOW_PRESETS.map((p) => el('option', { value: p.id, selected: windowSel.preset === p.id ? '' : null }, p.label)));

      const startInput = el('input', {
        type: 'time', step: '3600', class: 'field-input !py-2 text-[12.5px]',
        'aria-label': 'Analysis window start time', value: hhmm(windowSel.start),
        dataset: { windowStart: '' },
        onchange: (e) => {
          const h = parseHour(e.target.value);
          if (h != null) { windowSel.start = h; windowSel.preset = 'custom'; }
          syncWindowUi();
        },
      });

      const endInput = el('input', {
        type: 'time', step: '3600', class: 'field-input !py-2 text-[12.5px]',
        'aria-label': 'Analysis window end time', value: hhmm(windowSel.end),
        dataset: { windowEnd: '' },
        onchange: (e) => {
          const h = parseHour(e.target.value);
          if (h != null) { windowSel.end = h; windowSel.preset = 'custom'; }
          syncWindowUi();
        },
      });

      const field = (label, control) => el('label', { class: 'flex flex-col gap-1 min-w-0 flex-1' },
        el('span', { class: 'text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/70' }, label),
        control);

      return card({
        title: 'Report Analysis Window', ic: 'schedule',
        subtitle: 'Choose the hours the report analyses. All statistics and graphs are computed from this range only.',
        children: el('div', { class: 'flex flex-col gap-sm' },
          el('div', { class: 'flex gap-sm flex-wrap items-end' },
            field('Range', presetSelect),
            field('Start', startInput),
            field('End', endInput),
            btnGhost('Generate for window', 'play_arrow', () => generate())),
          el('p', { class: 'text-[11px] text-on-surface-variant/75', dataset: { windowSummary: '' } }, windowSummaryText())),
      });
    }

    function windowSummaryText() {
      const { start, end } = resolveWindow();
      const hours = end - start + 1;
      const preset = WINDOW_PRESETS.find((p) => p.id === windowSel.preset);
      const clamped = preset && preset.hours && hours < preset.hours
        ? ` Clamped to the end of the available 24-hour series (${preset.hours} h requested, ${hours} h available).`
        : '';
      return `Analysing ${hhmm(start)} – ${hhmm(end)} · ${hours} hourly observation${hours === 1 ? '' : 's'}.${clamped}`;
    }

    function syncWindowUi() {
      const { start, end } = resolveWindow();
      const presetEl = document.querySelector('[data-window-preset]');
      const startEl = document.querySelector('[data-window-start]');
      const endEl = document.querySelector('[data-window-end]');
      const summaryEl = document.querySelector('[data-window-summary]');
      if (presetEl) presetEl.value = windowSel.preset;
      if (startEl) startEl.value = hhmm(start);
      if (endEl) endEl.value = hhmm(end);
      if (summaryEl) summaryEl.textContent = windowSummaryText();
    }

    function renderList() {
      const reps = stashedReports();
      if (!reps.length) {
        return emptyState({ ic: 'post_add', title: 'No reports generated yet', message: 'Generate your first briefing from the current context.' });
      }
      return el('div', { class: 'flex flex-col gap-2' }, reps.map((r) => row(r)));
    }

    function row(r) {
      return el('div', { class: 'glass-chip rounded-xl p-3 flex items-center gap-sm flex-wrap hover-lift' },
        el('span', { class: 'w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0' }, icon('description', 'text-[17px]', false)),
        el('span', { class: 'min-w-0 flex-1' },
          el('span', { class: 'block text-[12.5px] font-bold truncate' }, r.meta && r.meta.title ? r.meta.title : `Heat Intelligence Report`),
          el('span', { class: 'block text-[10.5px] text-on-surface-variant/75' },
            `${r.meta && r.meta.location ? r.meta.location : ''} · ${r.meta && r.meta.generatedAt ? clockTime(r.meta.generatedAt) : ''} · ${r.id}`)),
        r.meta && r.meta.source ? el('span', { class: `source-badge ${r.meta.demo ? 'demo' : 'live'}` }, r.meta.demo ? 'Demo data' : 'Live · FortyGuard') : null,
        el('button', {
          class: 'squishy-btn bg-primary text-on-primary dark:bg-inverse-primary dark:text-inverse-on-surface rounded-full px-3.5 py-1.5 text-[11.5px] font-bold',
          onclick: () => window.open(reportUrl(r.id), '_blank', 'noopener'),
        }, 'Open'),
        el('button', {
          class: 'p-2 rounded-full hover:bg-error-container text-on-surface-variant',
          title: 'Remove from library',
          'aria-label': 'Remove report',
          onclick: () => {
            try {
              sessionStorage.setItem('therma.reports', JSON.stringify(stashedReports().filter((x) => x.id !== r.id)));
            } catch { /* ignore */ }
            const host = document.querySelector('[data-report-list]');
            if (host) host.replaceChildren(renderList());
          },
        }, icon('delete', 'text-[16px]', false)));
    }

    async function generate() {
      try {
        const win = windowPayload();
        toast(`Compiling heat intelligence report for ${hhmm(win.start)} – ${hhmm(win.end)}…`);
        const ctx = JSON.parse(JSON.stringify(getState().context));
        ctx.requestedWindow = win;
        const rep = await generateReport(ctx);
        stashReport({ id: rep.id, meta: rep.meta });
        toast('Report ready.', 'success');
        const host = document.querySelector('[data-report-list]');
        if (host) host.replaceChildren(renderList());
        window.open(reportUrl(rep.id), '_blank', 'noopener');
      } catch (err) {
        toast(diagnosticError(err, 'Report generation failed.'), 'error');
      }
    }
  },
};
