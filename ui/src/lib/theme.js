// Theme system (ported from public/app/theme.js)

const THEME_KEY = "therma.theme";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
  } catch {}
  return "system";
}

function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.textContent = isDark ? "light_mode" : "dark_mode";
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  });
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function initTheme() {
  const theme = getInitialTheme();
  applyTheme(theme);
  
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const current = localStorage.getItem(THEME_KEY) || "system";
    if (current === "system") applyTheme("system");
  });
  
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = localStorage.getItem(THEME_KEY) || "system";
      const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
      setTheme(next);
    });
  });
  
  window.__THERMA_THEME = { get: () => localStorage.getItem(THEME_KEY) || "system", set: setTheme };
}
