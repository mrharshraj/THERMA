// Zoe Operator Workspace — full-screen command console for the AI operator.
// Uses the same backend pipeline (POST /zoe + validated actions only).

import { getState } from '../app/store.js';
import { postZoe } from '../app/api.js';
import { el, icon, pageHeader, card, emptyState, btnGhost, toast } from '../app/widgets.js';
import { appContext, handleVisualization, open as openRail } from '../app/zoe.js';
import { navigate, ROUTES } from '../app/router.js';
import { ALLOWED_LABELS } from './_zoe-meta.js';

const QUICK = [
  ['Which area is hottest?', 'local_fire_department'],
  ['Why is this location high risk?', 'psychology_alt'],
  ['Compare my route options', 'route'],
  ['Show environmental conditions', 'air'],
  ['What are my priorities?', 'low_priority'],
  ['Prepare a cooling scenario', 'science'],
  ['Generate a report', 'description'],
];

let history = [];
let busy = false;

export default {
  title: 'Zoe Operator Workspace',
  layout: 'fixed',   // lg+: fixed console shell with scrolling columns; below lg the page scrolls
  async render(container) {
    container.appendChild(pageHeader({
      eyebrow: 'AI OPERATOR',
      title: 'Zoe Operator Workspace',
      subtitle: 'A dedicated console where Zoe operates THERMA for you — running analyses, controlling maps, navigating screens. Every action is validated against an application allowlist.',
      badge: el('span', { class: 'source-badge analysis' }, getState().health && getState().health.services && getState().health.services.gemini && getState().health.services.gemini.available ? 'Gemini reasoning' : 'On-device engine'),
      actions: [btnGhost('Open Side Panel', 'right_panel_open', () => openRail())],
    }));

    const grid = el('div', { class: 'grid gap-md flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]' });

    // ---------------- left: console ----------------
    const messagesHost = el('div', {
      class: 'flex-1 overflow-y-auto px-md py-sm flex flex-col gap-2.5 min-h-[280px] max-h-[52vh]',
    }, renderHistory());
    const consoleCard = card({
      title: 'Operator Console', ic: 'terminal',
      subtitle: 'Natural-language commands · THERMA scope only',
      pad: false,
      children: el('div', { class: 'flex flex-col h-full' },
        messagesHost,
        quickRow(),
        composer()),
    });
    grid.appendChild(consoleCard);

    // ---------------- right: capabilities + log ----------------
    const right = el('div', { class: 'flex flex-col gap-md min-w-0 overflow-y-auto pr-1' });

    right.appendChild(card({
      title: 'Capability Matrix', ic: 'checklist',
      children: el('div', { class: 'flex flex-col gap-1' },
        Object.entries(ALLOWED_LABELS).map(([name, label]) => el('div', { class: 'glass-chip rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px]' },
          icon('verified', 'text-[13px] text-green-600'), label))),
    }));

    right.appendChild(card({
      title: 'Action Log', ic: 'receipt_long',
      subtitle: 'Executed validated actions',
      children: el('div', { dataset: { actionLog: '' } },
        emptyState({ ic: 'bolt', title: 'No actions yet', message: 'Ask Zoe to operate the app — executed steps appear here.' })),
    }));

    right.appendChild(card({
      title: 'Scope Guardrails', ic: 'shield',
      children: el('div', { class: 'text-[11.5px] text-on-surface-variant/90 flex flex-col gap-1.5' },
        guardRow('rule', 'Answers are grounded in your live application context.'),
        guardRow('lock', 'Only allowlisted actions execute — no arbitrary code.'),
        guardRow('block', 'Non-THERMA questions receive a fixed refusal.')),
    }));

    grid.appendChild(right);
    container.appendChild(grid);

    function guardRow(icName, text) {
      return el('p', { class: 'flex items-start gap-2' }, icon(icName, 'text-[14px] shrink-0 mt-0.5 text-on-surface-variant'), el('span', {}, text));
    }

    function quickRow() {
      return el('div', { class: 'flex gap-1.5 overflow-x-auto px-md pb-1 shrink-0 border-t border-outline-variant/15 dark:border-outline/10 pt-sm' },
        QUICK.map(([q, ic]) => el('button', {
          class: 'squishy-btn glass-chip rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5',
          onclick: () => send(q),
        }, icon(ic, 'text-[13px]', false), q)));
    }

    function composer() {
      const input = el('input', {
        class: 'field-input flex-1 !rounded-xl',
        placeholder: 'Instruct Zoe… e.g. “run heat analysis on persistence layer”',
        'aria-label': 'Message Zoe',
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(input.value); });
      return el('div', { class: 'flex items-center gap-2 p-md pt-sm' },
        input,
        el('button', {
          class: 'w-10 h-10 rounded-xl bg-primary dark:bg-inverse-primary text-on-primary dark:text-inverse-on-surface flex items-center justify-center squishy-btn shrink-0',
          'aria-label': 'Send', onclick: () => send(input.value),
        }, icon('arrow_upward', 'text-[18px]', false)));
    }

    function renderHistory() {
      if (!history.length) {
        return emptyState({
          ic: 'smart_toy', title: 'Ready to operate THERMA',
          message: `Try “${QUICK[0][0]}” or pick any quick command below.`,
        });
      }
      return history.map((m) => bubble(m));
    }

    function bubble({ role, content, statuses }) {
      const rowEl = el('div', { class: `flex ${role === 'user' ? 'justify-end' : 'justify-start'} fade-up` });
      const b = el('div', { class: `${role === 'user' ? 'zoe-bubble-user' : 'zoe-bubble-bot'} max-w-[78%] px-4 py-2.5 text-[13.5px] leading-relaxed` },
        el('p', {}, content));
      if (statuses && statuses.length) {
        b.appendChild(el('div', { class: 'flex flex-wrap gap-1 mt-2' },
          statuses.map((s) => el('span', { class: 'action-status' },
            icon(s.done ? 'check_circle' : s.failed ? 'error' : 'sync', 'text-[12px]', false), s.text))));
      }
      rowEl.appendChild(b);
      return rowEl;
    }

    function repaint() {
      messagesHost.replaceChildren(...renderHistory());
      messagesHost.scrollTop = messagesHost.scrollHeight;
    }

    function logAction(name, args, ok) {
      const log = document.querySelector('[data-action-log]');
      if (!log) return;
      if (log.querySelector('.py-lg')) log.innerHTML = '';
      log.prepend(el('div', { class: 'glass-chip rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px] fade-up mb-1.5 last:mb-0' },
        icon(ok ? 'check_circle' : 'error', `text-[13px] ${ok ? 'text-green-600' : 'text-red-500'}`),
        el('span', { class: 'font-bold' }, name),
        el('span', { class: 'text-on-surface-variant/75 truncate ml-auto' }, JSON.stringify(args || {}).slice(0, 42))));
    }

    async function send(text) {
      const msg = String(text || '').trim();
      if (!msg || busy) return;
      busy = true;
      history.push({ role: 'user', content: msg });
      repaint();
      const thinking = bubble({ role: 'model', content: '…' });
      thinking.className += ' opacity-60';
      messagesHost.appendChild(thinking);
      messagesHost.scrollTop = messagesHost.scrollHeight;

      try {
        const res = await postZoe({
          message: msg,
          context: appContext(),
          history: history.slice(-8).map(({ role, content }) => ({ role, content })),
        });
        thinking.remove();
        const statuses = [];
        history.push({ role: 'model', content: res.message, statuses });
        repaint();

        for (const act of res.actions || []) {
          if (!act || !act.name) continue;
          const st = { text: `${act.name}…`, done: false };
          statuses.push(st);
          repaint();
          try {
            await executeExternal(act.name, act.args || {});
            st.done = true;
            logAction(act.name, act.args, true);
          } catch (err) {
            st.failed = true; st.text = `${act.name} failed`;
            logAction(act.name, act.args, false);
          }
          repaint();
        }
        if (res.visualization && res.visualization.type !== 'text_only') {
          await handleVisualization(res.visualization);
        }
      } catch (err) {
        thinking.remove();
        history.push({ role: 'model', content: "I couldn't reach the reasoning service. Check the backend connection." });
        toast(err.message || 'Request failed.', 'error');
      } finally {
        busy = false;
        repaint();
      }
    }

    async function executeExternal(name, args) {
      const mod = await import('../app/zoe.js');
      return mod.executeForWorkspace(name, args);
    }
  },
};
