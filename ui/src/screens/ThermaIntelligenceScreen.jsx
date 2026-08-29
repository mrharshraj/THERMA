// THERMA Intelligence Screen (from ui/therma_intelligence/DESIGN.md)

import { el, icon } from "../lib/widgets.js";

export function mount(host, route) {
  host.innerHTML = "";
  host.className = "flex flex-col h-full";

  const main = el("main", { class: "flex flex-col h-full p-[32px]" },
    // Header
    el("div", { class: "mb-8" },
      el("h1", { class: "font-display text-[48px] leading-[56px] tracking-tight text-on-surface mb-2" }, "THERMA Intelligence"),
      el("p", { class: "font-body text-[16px] leading-[24px] text-on-surface-variant max-w-3xl" }, "Design system documentation and component library for the THERMA Heat Intelligence Platform.")
    ),

    // Brand & Style
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("palette", "text-primary"), "Brand & Style"),
      el("div", { class: "prose max-w-4xl space-y-4 text-on-surface-variant" },
        el("p", {}, "The design system is engineered for high-stakes operational environments, functioning as a \"Command Center\" for heat intelligence. The brand personality is ", el("strong", {}, "authoritative, predictive, and operational"), ". It prioritizes clarity over decoration, ensuring that critical data is processed instantly by the user."),
        el("p", {}, "The aesthetic follows a ", el("strong", {}, "High-Contrast Modern"), " direction with ", el("strong", {}, "Glassmorphism-lite"), " accents. It utilizes a restrained \"Intelligence\" aesthetic—clean surfaces, generous white space in analytical views, and dense, structured data density in monitoring views. Surfaces use subtle translucency to maintain context over large-scale interactive maps, while high-contrast borders and deep charcoal backgrounds provide a professional, military-grade feel.")
      )
    ),

    // Colors
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("format_color_fill", "text-primary"), "Colors"),
      el("p", { class: "text-on-surface-variant mb-6" }, "The palette is anchored by ", el("strong", {}, "Deep Charcoal (#121212)"), " for structural elements and ", el("strong", {}, "Off-White (#F8F9FA)"), " for high-legibility light mode surfaces. The primary interaction color is a high-visibility ", el("strong", {}, "Vibrant Orange (#FF5200)"), "."),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4" }, "Color Logic"),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Base:"), " In dark mode, use charcoal for backgrounds and glass panels for secondary content. In light mode, use off-white with subtle grey borders."),
        el("li", {}, el("strong", {}, "Risk Indicators:"), " Five distinct steps ranging from Emerald (Safe) to Deep Maroon (Critical). These must be used consistently across all map markers and data tables."),
        el("li", {}, el("strong", {}, "Thermal Intensity:"), " A custom continuous gradient used for heatmaps, moving from Deep Purple (low intensity) through Magenta and Orange to Bright Yellow (peak intensity).")
      ),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mt-8 mb-4" }, "Color Palette"),
      colorSwatches()
    ),

    // Typography
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("font_download", "text-primary"), "Typography"),
      el("p", { class: "text-on-surface-variant mb-6" }, "This design system uses ", el("strong", {}, "Geist"), " for its clean, technical aesthetic and high legibility at various scales. For numerical data, coordinates, and sensor readings, ", el("strong", {}, "JetBrains Mono"), " is employed to ensure tabular figures align perfectly in dense data columns."),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4" }, "Type Roles"),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Display/Headline:"), " High-impact, bold weights with tight tracking for overview dashboards."),
        el("li", {}, el("strong", {}, "Body:"), " Open line heights for readability during long periods of monitoring."),
        el("li", {}, el("strong", {}, "Data-Mono:"), " Specifically for KPI cards, map coordinates, and timestamped logs. Tabular lining is mandatory for all numerical output to prevent \"jumping\" during real-time updates.")
      ),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mt-8 mb-4" }, "Type Scale"),
      typeScaleTable()
    ),

    // Layout & Spacing
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("dashboard", "text-primary"), "Layout & Spacing"),
      el("p", { class: "text-on-surface-variant mb-6" }, "The layout is designed for ", el("strong", {}, "Map-Heavy Workflows"), ". It utilizes a hybrid grid system:"),
      el("ol", { class: "space-y-2 text-on-surface-variant ml-6 list-decimal" },
        el("li", {}, el("strong", {}, "The Map Layer:"), " A full-bleed background layer that occupies 100% of the viewport."),
        el("li", {}, el("strong", {}, "The Interface Layer:"), " A floating grid of 12 columns with 16px gutters. Panels should snap to these columns.")
      ),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mt-8 mb-4" }, "Breakpoints"),
      breakpointTable(),
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mt-8 mb-4" }, "Spacing Tokens"),
      spacingTable()
    ),

    // Elevation & Depth
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("layers", "text-primary"), "Elevation & Depth"),
      el("p", { class: "text-on-surface-variant mb-6" }, "This design system uses ", el("strong", {}, "Tonal Layers"), " and ", el("strong", {}, "Glassmorphism-lite"), " to create a sense of operational depth without sacrificing clarity."),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Level 0 (Map):"), " The base layer. All map tiles should use a \"Dark/Mono\" or \"Satellite\" style."),
        el("li", {}, el("strong", {}, "Level 1 (Panels):"), " Semi-transparent surfaces (Background Blur: 20px, Opacity: 80%). Use a 1px solid border (Opacity: 10%) in the primary neutral color to define edges."),
        el("li", {}, el("strong", {}, "Level 2 (Popovers/Modals):"), " Solid backgrounds with a deep, diffused ambient shadow (Color: Primary, Blur: 40px, Spread: -10px) to indicate high-priority interaction."),
        el("li", {}, el("strong", {}, "Focus States:"), " 2px solid Vibrant Orange ring with 4px offset.")
      )
    ),

    // Shapes
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("crop", "text-primary"), "Shapes"),
      el("p", { class: "text-on-surface-variant mb-6" }, "The shape language is ", el("strong", {}, "Technical and Precise"), "."),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Standard Radius:"), " 4px (Soft) for buttons, input fields, and small UI widgets. This maintains a sharp, professional \"instrument\" feel."),
        el("li", {}, el("strong", {}, "Large Radius:"), " 12px for primary dashboard cards and floating map panels to distinguish them from the rigid map grid."),
        el("li", {}, el("strong", {}, "Data Points:"), " Map markers should be hexagonal or circular with high-contrast strokes to ensure visibility against complex satellite imagery.")
      )
    ),

    // Components
    el("section", { class: "mb-12" },
      el("h2", { class: "font-headline text-[32px] leading-[40px] text-on-surface mb-4 flex items-center gap-2" }, icon("extension", "text-primary"), "Components"),
      
      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 mt-8" }, "Buttons"),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Primary:"), " Solid Deep Charcoal (Dark Mode) or Off-White (Light Mode) with white/black text. High-contrast."),
        el("li", {}, el("strong", {}, "Action:"), " Vibrant Orange background for \"Deploy\" or \"Alert\" actions."),
        el("li", {}, el("strong", {}, "Ghost:"), " 1px border with monochromatic icons for secondary map controls.")
      ),

      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 mt-8" }, "KPI Cards"),
      el("p", { class: "text-on-surface-variant mb-4" }, "Cards must feature a ", el("strong", {}, "\"Data-Mono\""), " primary value, a sparkline showing the 24h heat trend, and a color-coded status indicator in the top right corner using the Risk Severity tokens."),

      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 mt-8" }, "Map Controls"),
      el("p", { class: "text-on-surface-variant mb-4" }, "Floating vertical button groups. Icons should be 20px, stroke-based (2px weight), centered in 40px square frosted-glass tiles."),

      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 mt-8" }, "Data Visualizations"),
      el("ul", { class: "space-y-2 text-on-surface-variant ml-6 list-disc" },
        el("li", {}, el("strong", {}, "Heatmaps:"), " Use the ", el("code", { class: "bg-surface-container px-1 rounded text-primary" }, "thermal_gradient"), " variable."),
        el("li", {}, el("strong", {}, "Line Charts:"), " 2px stroke width, no area fill, with points highlighted only on hover."),
        el("li", {}, el("strong", {}, "Risk Tables:"), " Row height 48px, utilizing ", el("code", { class: "bg-surface-container px-1 rounded text-primary" }, "data-mono"), " for all numerical columns.")
      ),

      el("h3", { class: "font-headline text-[24px] leading-[32px] text-on-surface mb-4 mt-8" }, "Input Fields"),
      el("p", { class: "text-on-surface-variant" }, "Dark backgrounds with subtle 1px borders. Focus state must change the border color to Vibrant Orange. Labels should be uppercase, 10px, bold JetBrains Mono.")
    )
  );

  host.appendChild(main);
}

function colorSwatches() {
  const colors = [
    { name: "Background", value: "#0c141f", text: "#dce2f3" },
    { name: "Surface", value: "#0c141f", text: "#dce2f3" },
    { name: "Surface Container", value: "#19202b", text: "#dce2f3" },
    { name: "Surface Container High", value: "#232a36", text: "#dce2f3" },
    { name: "Surface Container Highest", value: "#2e3541", text: "#dce2f3" },
    { name: "Primary", value: "#c8c6c5", text: "#313030" },
    { name: "Primary Container", value: "#121212", text: "#7e7d7d" },
    { name: "Secondary", value: "#c5c7c8", text: "#2e3132" },
    { name: "Secondary Container", value: "#494c4d", text: "#babcbd" },
    { name: "Tertiary", value: "#ffb59d", text: "#5d1800" },
    { name: "Tertiary Container", value: "#290600", text: "#e14700" },
    { name: "Error", value: "#ffb4ab", text: "#690005" },
    { name: "Error Container", value: "#93000a", text: "#ffdad6" },
    { name: "Outline", value: "#8e9192", text: "#1a1b1f" },
    { name: "Outline Variant", value: "#444748", text: "#dce2f3" }
  ];

  return el("div", { class: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" },
    ...colors.map(c => el("div", { class: "bg-surface-container rounded-xl p-6 shadow-sm" },
      el("div", { class: "w-full h-20 rounded-lg mb-4", style: `background: ${c.value}; border: 1px solid #444748;` }),
      el("div", { class: "font-data text-[10px] uppercase text-on-surface-variant mb-1" }, c.name),
      el("div", { class: "font-data text-[12px] text-on-surface font-bold", style: `color: ${c.text}` }, c.value)
    ))
  );
}

function typeScaleTable() {
  const types = [
    { role: "Display LG", family: "Geist", size: "48px", weight: "700", lineHeight: "56px", letterSpacing: "-0.02em" },
    { role: "Headline LG", family: "Geist", size: "32px", weight: "600", lineHeight: "40px", letterSpacing: "-0.01em" },
    { role: "Headline MD", family: "Geist", size: "24px", weight: "600", lineHeight: "32px", letterSpacing: "0" },
    { role: "Body LG", family: "Geist", size: "18px", weight: "400", lineHeight: "28px", letterSpacing: "0" },
    { role: "Body MD", family: "Geist", size: "16px", weight: "400", lineHeight: "24px", letterSpacing: "0" },
    { role: "Data Mono", family: "JetBrains Mono", size: "14px", weight: "500", lineHeight: "20px", letterSpacing: "0.01em" }
  ];

  return el("div", { class: "overflow-x-auto" },
    el("table", { class: "w-full text-left border-collapse" },
      el("thead", { class: "bg-surface-container" },
        el("tr", {},
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Role"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Font Family"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Size"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Weight"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Line Height"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Letter Spacing")
        )
      ),
      el("tbody", { class: "divide-y divide-outline-variant/5" },
        ...types.map(t => el("tr", { class: "hover:bg-surface-container-highest/50" },
          el("td", { class: "px-4 py-3 font-body text-on-surface font-semibold" }, t.role),
          el("td", { class: "px-4 py-3 font-body text-on-surface-variant" }, t.family),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, t.size),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, t.weight),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, t.lineHeight),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, t.letterSpacing)
        ))
      )
    )
  );
}

function breakpointTable() {
  const breakpoints = [
    { name: "Desktop", range: "1440px+", description: "Fixed left-hand analytical sidebar (400px) and floating right-hand contextual widgets" },
    { name: "Tablet", range: "768px - 1439px", description: "Collapsible sidebars; bottom-sheet drawer for asset details" },
    { name: "Mobile", range: "Under 768px", description: "Single-column focus. The map remains the background, with data delivered via semi-transparent bottom sheets" }
  ];

  return el("div", { class: "overflow-x-auto" },
    el("table", { class: "w-full text-left border-collapse" },
      el("thead", { class: "bg-surface-container" },
        el("tr", {},
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Breakpoint"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Range"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Behavior")
        )
      ),
      el("tbody", { class: "divide-y divide-outline-variant/5" },
        ...breakpoints.map(b => el("tr", { class: "hover:bg-surface-container-highest/50" },
          el("td", { class: "px-4 py-3 font-body text-on-surface font-semibold" }, b.name),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, b.range),
          el("td", { class: "px-4 py-3 font-body text-on-surface-variant" }, b.description)
        ))
      )
    )
  );
}

function spacingTable() {
  const spacing = [
    { token: "unit", value: "4px", description: "Base unit" },
    { token: "gutter", value: "16px", description: "Column gutter" },
    { token: "margin-mobile", value: "16px", description: "Mobile margin" },
    { token: "margin-desktop", value: "32px", description: "Desktop margin" },
    { token: "panel-width", value: "400px", description: "Sidebar panel width" }
  ];

  return el("div", { class: "overflow-x-auto" },
    el("table", { class: "w-full text-left border-collapse" },
      el("thead", { class: "bg-surface-container" },
        el("tr", {},
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Token"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Value"),
          el("th", { class: "px-4 py-3 font-data text-[10px] uppercase text-outline tracking-wider font-bold" }, "Description")
        )
      ),
      el("tbody", { class: "divide-y divide-outline-variant/5" },
        ...spacing.map(s => el("tr", { class: "hover:bg-surface-container-highest/50" },
          el("td", { class: "px-4 py-3 font-data text-on-surface font-semibold" }, s.token),
          el("td", { class: "px-4 py-3 font-data text-on-surface" }, s.value),
          el("td", { class: "px-4 py-3 font-body text-on-surface-variant" }, s.description)
        ))
      )
    )
  );
}

export function unmount() {}
