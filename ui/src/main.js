import { initTheme } from "./lib/theme.js";
import { initStore } from "./lib/store.js";
import { initRouter } from "./lib/router.js";
import { initShell } from "./app/shell.js";
import { initZoe } from "./lib/zoe.js";
import { initSearch } from "./lib/search.js";
import { initVizWorkspace } from "./lib/viz-workspace.js";
import { boot } from "./app/boot.js";

// Initialize core systems
initTheme();
initStore();
initShell();
initVizWorkspace();
initSearch();
initZoe();

// Start router and boot app
initRouter();
boot();
