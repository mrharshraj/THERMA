---
name: Therma Intelligence
colors:
  surface: '#0c141f'
  surface-dim: '#0c141f'
  surface-bright: '#323946'
  surface-container-lowest: '#070e19'
  surface-container-low: '#151c27'
  surface-container: '#19202b'
  surface-container-high: '#232a36'
  surface-container-highest: '#2e3541'
  on-surface: '#dce2f3'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#dce2f3'
  inverse-on-surface: '#2a313d'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c8c6c5'
  primary: '#c8c6c5'
  on-primary: '#313030'
  primary-container: '#121212'
  on-primary-container: '#7e7d7d'
  inverse-primary: '#5f5e5e'
  secondary: '#c5c7c8'
  on-secondary: '#2e3132'
  secondary-container: '#494c4d'
  on-secondary-container: '#babcbd'
  tertiary: '#ffb59d'
  on-tertiary: '#5d1800'
  tertiary-container: '#290600'
  on-tertiary-container: '#e14700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e1e3e4'
  secondary-fixed-dim: '#c5c7c8'
  on-secondary-fixed: '#191c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832600'
  background: '#0c141f'
  on-background: '#dce2f3'
  surface-variant: '#2e3541'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  panel-width: 400px
---

## Brand & Style

The design system is engineered for high-stakes operational environments, functioning as a "Command Center" for heat intelligence. The brand personality is **authoritative, predictive, and operational**. It prioritizes clarity over decoration, ensuring that critical data is processed instantly by the user.

The aesthetic follows a **High-Contrast Modern** direction with **Glassmorphism-lite** accents. It utilizes a restrained "Intelligence" aesthetic—clean surfaces, generous white space in analytical views, and dense, structured data density in monitoring views. Surfaces use subtle translucency to maintain context over large-scale interactive maps, while high-contrast borders and deep charcoal backgrounds provide a professional, military-grade feel.

## Colors

The palette is anchored by **Deep Charcoal (#121212)** for structural elements and **Off-White (#F8F9FA)** for high-legibility light mode surfaces. The primary interaction color is a high-visibility **Vibrant Orange (#FF5200)**.

### Color Logic
- **Base:** In dark mode, use charcoal for backgrounds and glass panels for secondary content. In light mode, use off-white with subtle grey borders.
- **Risk Indicators:** Five distinct steps ranging from Emerald (Safe) to Deep Maroon (Critical). These must be used consistently across all map markers and data tables.
- **Thermal Intensity:** A custom continuous gradient used for heatmaps, moving from Deep Purple (low intensity) through Magenta and Orange to Bright Yellow (peak intensity).

## Typography

This design system uses **Geist** for its clean, technical aesthetic and high legibility at various scales. For numerical data, coordinates, and sensor readings, **JetBrains Mono** is employed to ensure tabular figures align perfectly in dense data columns.

### Type Roles
- **Display/Headline:** High-impact, bold weights with tight tracking for overview dashboards.
- **Body:** Open line heights for readability during long periods of monitoring.
- **Data-Mono:** Specifically for KPI cards, map coordinates, and timestamped logs. Tabular lining is mandatory for all numerical output to prevent "jumping" during real-time updates.

## Layout & Spacing

The layout is designed for **Map-Heavy Workflows**. It utilizes a hybrid grid system:
1. **The Map Layer:** A full-bleed background layer that occupies 100% of the viewport.
2. **The Interface Layer:** A floating grid of 12 columns with 16px gutters. Panels should snap to these columns.

### Breakpoints
- **Desktop (1440px+):** Fixed left-hand analytical sidebar (400px) and floating right-hand contextual widgets.
- **Tablet (768px - 1439px):** Collapsible sidebars; bottom-sheet drawer for asset details.
- **Mobile (Under 768px):** Single-column focus. The map remains the background, with data delivered via semi-transparent bottom sheets.

## Elevation & Depth

This design system uses **Tonal Layers** and **Glassmorphism-lite** to create a sense of operational depth without sacrificing clarity.

- **Level 0 (Map):** The base layer. All map tiles should use a "Dark/Mono" or "Satellite" style.
- **Level 1 (Panels):** Semi-transparent surfaces (Background Blur: 20px, Opacity: 80%). Use a 1px solid border (Opacity: 10%) in the primary neutral color to define edges.
- **Level 2 (Popovers/Modals):** Solid backgrounds with a deep, diffused ambient shadow (Color: Primary, Blur: 40px, Spread: -10px) to indicate high-priority interaction.
- **Focus States:** 2px solid Vibrant Orange ring with 4px offset.

## Shapes

The shape language is **Technical and Precise**. 
- **Standard Radius:** 4px (Soft) for buttons, input fields, and small UI widgets. This maintains a sharp, professional "instrument" feel.
- **Large Radius:** 12px for primary dashboard cards and floating map panels to distinguish them from the rigid map grid.
- **Data Points:** Map markers should be hexagonal or circular with high-contrast strokes to ensure visibility against complex satellite imagery.

## Components

### Buttons
- **Primary:** Solid Deep Charcoal (Dark Mode) or Off-White (Light Mode) with white/black text. High-contrast.
- **Action:** Vibrant Orange background for "Deploy" or "Alert" actions.
- **Ghost:** 1px border with monochromatic icons for secondary map controls.

### KPI Cards
Cards must feature a "Data-Mono" primary value, a sparkline showing the 24h heat trend, and a color-coded status indicator in the top right corner using the Risk Severity tokens.

### Map Controls
Floating vertical button groups. Icons should be 20px, stroke-based (2px weight), centered in 40px square frosted-glass tiles.

### Data Visualizations
- **Heatmaps:** Use the `thermal_gradient` variable.
- **Line Charts:** 2px stroke width, no area fill, with points highlighted only on hover.
- **Risk Tables:** Row height 48px, utilizing `data-mono` for all numerical columns.

### Input Fields
Dark backgrounds with subtle 1px borders. Focus state must change the border color to Vibrant Orange. Labels should be uppercase, 10px, bold JetBrains Mono.