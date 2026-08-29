/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,html}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Material 3 Dark (from Stitch)
        "on-secondary-fixed": "#191c1d",
        "on-surface": "#dce2f3",
        "surface-bright": "#323946",
        error: "#ffb4ab",
        "on-secondary-fixed-variant": "#454748",
        "on-error": "#690005",
        "surface-container-low": "#151c27",
        background: "#0c141f",
        "surface-container-high": "#232a36",
        "surface-container-highest": "#2e3541",
        "secondary-fixed-dim": "#c5c7c8",
        tertiary: "#ffb59d",
        "on-tertiary-fixed": "#390c00",
        "on-secondary": "#2e3132",
        "primary-fixed-dim": "#c8c6c5",
        "on-primary-fixed-variant": "#474646",
        "on-tertiary-container": "#e14700",
        "surface-variant": "#2e3541",
        primary: "#c8c6c5",
        "on-primary-fixed": "#1c1b1b",
        "surface-container": "#19202b",
        "tertiary-fixed": "#ffdbd0",
        "surface-dim": "#0c141f",
        "primary-fixed": "#e5e2e1",
        "secondary-container": "#494c4d",
        secondary: "#c5c7c8",
        "secondary-fixed": "#e1e3e4",
        "on-primary": "#313030",
        "outline-variant": "#444748",
        outline: "#8e9192",
        "inverse-surface": "#dce2f3",
        "on-primary-container": "#7e7d7d",
        "surface-tint": "#c8c6c5",
        "inverse-on-surface": "#2a313d",
        "on-tertiary": "#5d1800",
        "on-tertiary-fixed-variant": "#832600",
        "surface-container-lowest": "#070e19",
        "error-container": "#93000a",
        "on-background": "#dce2f3",
        surface: "#0c141f",
        "tertiary-container": "#290600",
        "primary-container": "#121212",
        "tertiary-fixed-dim": "#ffb59d",
        "inverse-primary": "#5f5e5e",
        "on-error-container": "#ffdad6",
        "on-surface-variant": "#c4c7c7",
        "on-secondary-container": "#babcbd",
        // THERMA semantic colors
        "thermal-low": "#2b7de9",
        "thermal-mid": "#f97316",
        "thermal-high": "#b91c1c"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "margin-mobile": "16px",
        gutter: "16px",
        unit: "4px",
        "margin-desktop": "32px",
        "panel-width": "400px"
      },
      fontFamily: {
        body: ["Geist", "sans-serif"],
        headline: ["Geist", "sans-serif"],
        data: ["Geist", "monospace"]
      }
    }
  },
  plugins: []
};
