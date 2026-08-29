// Role Selector — the single onboarding screen between Splash and the app.
// Rendered OUTSIDE the application shell (router.js activateShell): no
// sidebar, no topbar, no mobile navigation — a deliberate full-viewport
// onboarding moment. Shown when no role is persisted yet, or via Settings →
// Change Role.

import { el, icon } from '../app/widgets.js';
import { ROLES, getSelectedRole, setSelectedRole } from '../app/roles.js';
import { navigate } from '../app/router.js';

export default {
  title: 'Role Selector',
  async render(container) {
    let chosen = getSelectedRole();

    const wrap = el('div', { class: 'min-h-screen flex flex-col items-center justify-center max-w-5xl mx-auto py-lg' });

    wrap.appendChild(el('div', { class: 'text-center mb-lg fade-in' },
      el('div', { class: 'flex items-center justify-center gap-2 mb-3' },
        el('img', { src: '/logo.png', alt: 'THERMA logo', class: 'h-7 w-auto object-contain', onerror: 'this.style.display=\'none\'' }),
        el('span', { class: 'font-headline-md text-headline-md tracking-tight' }, 'THERMA')),
      el('h1', { class: 'font-headline-lg text-headline-lg tracking-tight text-on-surface' }, 'How will you use THERMA?'),
      el('p', { class: 'text-body-md text-on-surface-variant mt-2' }, 'Choose your primary workflow. You can change this later.')));

    const grid = el('div', { class: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md w-full' });
    const cards = new Map();

    const applySelection = () => {
      cards.forEach((cardEl, id) => {
        const meta = ROLES.find((r) => r.id === id);
        const active = id === chosen;
        // ALL TOOLS is an access profile, not a persona — the dashed border
        // sets it apart without leaving the monochrome system.
        const base = meta && meta.platform
          ? 'squishy-btn glass-panel rounded-2xl p-md text-left hover-lift fade-in border-dashed'
          : 'squishy-btn glass-panel rounded-2xl p-md text-left hover-lift fade-in';
        cardEl.className = `${base} ${active ? 'ring-2 ring-primary' : ''}`;
        cardEl.setAttribute('aria-pressed', active ? 'true' : 'false');
        const check = cardEl.querySelector('[role="img"][data-check]');
        if (check) check.textContent = active ? 'check_circle' : 'radio_button_unchecked';
      });
      continueBtn.classList.toggle('opacity-40', !chosen);
      continueBtn.classList.toggle('cursor-not-allowed', !chosen);
      continueBtn.setAttribute('aria-disabled', chosen ? 'false' : 'true');
    };

    for (const role of ROLES) {
      const card = el('button', {
        type: 'button',
        class: 'squishy-btn glass-panel rounded-2xl p-md text-left hover-lift',
        'aria-pressed': 'false',
        dataset: { roleCard: role.id },
        onclick: () => { chosen = role.id; applySelection(); },
      },
      el('div', { class: 'flex items-center justify-between mb-sm' },
        el('span', { class: 'w-11 h-11 rounded-xl bg-primary-container flex items-center justify-center shrink-0' },
          icon(role.icon, 'text-[22px] text-on-primary', false)),
        el('span', {
          class: 'material-symbols-outlined text-[20px] text-on-surface-variant/70',
          'aria-hidden': 'true', 'data-check': '', role: 'img',
        }, 'radio_button_unchecked')),
      el('span', { class: 'block font-headline-md text-[16px] font-bold tracking-tight mb-1' }, role.name),
      el('span', { class: 'block text-[12px] text-on-surface-variant/90 leading-snug mb-sm' }, role.desc),
      el('span', { class: 'flex flex-col gap-1' },
        role.bullets.map((b) => el('span', { class: 'flex items-center gap-1.5 text-[11px] text-on-surface-variant/80' },
          icon('check', 'text-[13px] opacity-70 shrink-0', false), b))));
      cards.set(role.id, card);
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    const continueBtn = el('button', {
      class: 'squishy-btn bg-primary text-on-primary rounded-full px-lg py-3 text-[13.5px] font-bold',
      'aria-disabled': 'true',
      onclick: () => {
        if (!chosen) return;
        setSelectedRole(chosen);
        navigate('overview');
      },
    }, 'Continue');

    wrap.appendChild(el('div', { class: 'flex items-center justify-center gap-sm mt-lg' },
      continueBtn,
      el('span', { class: 'text-[11px] text-on-surface-variant/70' }, 'Every capability stays available whatever you choose.')));

    container.appendChild(wrap);
    applySelection();
  },
};
