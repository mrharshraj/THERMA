// Report analysis window — the hour range a report is generated for.
//
// Shared by the Reports screen (which owns the UI) and Zoe (which may scope a
// window from the user's phrasing). Lives here rather than in the screen module
// so both can import it without a circular dependency.
//
// The backend applies NO default window: whatever is resolved here is what the
// report's statistics and graphs are computed from.

export const WINDOW_PRESETS = [
  { id: 'full', label: 'Full available range' },
  { id: 'next1', label: 'Next 1 hour', hours: 1 },
  { id: 'next3', label: 'Next 3 hours', hours: 3 },
  { id: 'next6', label: 'Next 6 hours', hours: 6 },
  { id: 'next12', label: 'Next 12 hours', hours: 12 },
  { id: 'next24', label: 'Next 24 hours', hours: 24 },
  { id: 'custom', label: 'Custom' },
];

export const clampHour = (h) => Math.max(0, Math.min(23, Math.round(Number(h) || 0)));
export const hhmm = (h) => `${String(clampHour(h)).padStart(2, '0')}:00`;

export function parseHour(value) {
  const m = /^(\d{1,2})/.exec(String(value || ''));
  return m ? clampHour(m[1]) : null;
}

// Current selection, persisted for the browser session.
export const windowSel = { preset: 'full', start: 0, end: 23 };

// Resolves the selection to concrete hours. The hourly series covers one
// 24-hour day (hours 0–23), so a "next N hours" range is clamped at 23 rather
// than wrapping into a day for which there are no observations.
export function resolveWindow(sel = windowSel) {
  if (sel.preset === 'custom') {
    const s = clampHour(sel.start);
    const e = clampHour(sel.end);
    return { start: Math.min(s, e), end: Math.max(s, e) };
  }
  const preset = WINDOW_PRESETS.find((p) => p.id === sel.preset);
  if (!preset || !preset.hours) return { start: 0, end: 23 };
  const now = new Date().getHours();
  return { start: now, end: Math.min(23, now + preset.hours - 1) };
}

// The payload the backend validates. `duration` is an inclusive hour count.
export function windowPayload(sel = windowSel) {
  const { start, end } = resolveWindow(sel);
  return { start, end, duration: end - start + 1 };
}
