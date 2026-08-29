// Theme controller — THERMA is DARK-ONLY.
// The premium dark/charcoal palette is the product surface; there is no
// light mode, no theme switching and no system-theme detection. This module
// remains only so existing imports keep working: it locks the palette to
// dark and exposes the tiny surface the map engine uses.

export const PALETTE_HAS_LIGHT_VARIANT = false;

export function isDarkTheme() {
  return true;
}

export function resolveDark() {
  return true;
}

// No-op kept for API compatibility — there is nothing to apply or persist.
export function applyTheme() {
  return true;
}

export function initTheme() {
  document.documentElement.dataset.theme = 'dark';
}

export function setTheme() { /* dark-only: no-op */ }

export function cycleTheme() { /* dark-only: no-op */ }

export function bindThemeToggles() { /* no toggles exist anymore */ }
