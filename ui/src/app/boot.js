// Application boot sequence

import { getState, setState } from "../lib/store.js";
import { getHealth, getFortyGuardStatus, loadContextFor, geoPlaces } from "../lib/api.js";
import { navigate } from "../lib/router.js";
import { toast } from "../lib/widgets.js";

const $ = (id) => document.getElementById(id);

function splashProgress(pct, label) {
  const bar = $("progress-bar");
  if (bar) bar.style.width = `${pct}%`;
  const status = $("init-text");
  if (status && label) status.textContent = label;
}

async function boot() {
  splashProgress(25, "Linking geospatial protocol\u2026");

  // Health + FortyGuard status in parallel
  const healthTask = getHealth()
    .then(h => { setState({ health: h }); return h; })
    .catch(() => null);
  const fgTask = getFortyGuardStatus()
    .then(s => { setState({ fgStatus: s }); return s; })
    .catch(() => null);

  // Default location: Downtown Miami
  let place = null;
  try {
    const places = await geoPlaces();
    place = (places.results || []).find(p => p.id === "miami-downtown") || (places.results || [])[0] || null;
    setState({ place });
  } catch {}

  // Initial context load
  let ctxError = null;
  if (place) {
    try {
      splashProgress(80, "Generating hyperlocal heat intelligence\u2026");
      await Promise.race([
        loadContextFor(place.id),
        new Promise(r => setTimeout(r, 30000))
      ]);
    } catch (err) {
      ctxError = err;
    }
  }
  await fgTask;

  splashProgress(100, "Entering command view\u2026");

  // Navigate to overview
  setTimeout(() => {
    navigate("overview");
  }, 350);

  // Remove splash once first screen renders
  requestAnimationFrame(() => {
    setTimeout(() => {
      const splash = $("splash");
      if (splash) {
        splash.style.transition = "opacity 450ms ease";
        splash.style.opacity = "0";
        document.getElementById("app").classList.remove("opacity-0");
        setTimeout(() => splash.remove(), 480);
      }
      setState({ booted: true });
      if (ctxError) toast("Live heat intelligence unavailable \u2014 showing recovery options.", "warn");
      window.dispatchEvent(new Event("resize"));
    }, 350);
  });
}

export { boot };
