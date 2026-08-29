// Environmental Intelligence — /environment screen (environmental_intelligence_2).

import { getState } from '../app/store.js';
import { loadEnvironmentFor } from '../app/api.js';
import { el, icon, pageHeader, card, statTile, sourceBadge, tempF, loadingState, errorState, emptyState, btnGhost, clockTime } from '../app/widgets.js';
import { placePicker, modeBadgeFor } from '../app/placepick.js';
import { lineChart, barChart, sparkline } from '../app/charts.js';
import { bestTimeCard } from '../app/besttime.js';
import { navigate, screenEvent, rerenderScreen } from '../app/router.js';

export default {
  title: 'Environmental Intelligence',
  async render(container) {
    const st = getState();
    const env = resolveEnv(st);

    // Register the data-refresh hook FIRST (loading/error branches return
    // early below; a screen mounted mid-load must still update when data lands).
    screenEvent(window, 'therma:context', () => rerenderScreen('environment', container));

    const placeLabel = (st.place && st.place.display)
      || (st.context && st.context.location && st.context.location.display)
      || 'the selected area';

    container.appendChild(pageHeader({
      eyebrow: 'FORTYGUARD ENVIRONMENTAL PARAMETERS',
      title: 'Environmental Intelligence',
      subtitle: env ? `Hourly environmental context for <b>${env.location || placeLabel}</b>. Only parameters returned by the API are shown.` : 'Hourly environmental context around the selected heat layer.',
      badge: env ? sourceBadge(env.source, env.source === 'demo' || env.source === 'therma-demo') : null,
      actions: [
        placePicker(),
        btnGhost('Refresh', 'refresh', () => retryEnv(container, { force: true })),
      ],
    }));

    if (!env && (st.envLoading || st.contextLoading)) {
      container.appendChild(loadingState('Fetching environmental parameters…', 'FortyGuard is assembling the hourly series for this area.'));
      return;
    }
    if (!env && st.envError) {
      container.appendChild(errorState({
        title: 'Environmental data unavailable.',
        err: st.envError,
        retry: () => retryEnv(container),
        onRelocate: () => navigate('search'),
        onDemo: () => import('../app/placepick.js').then((m) => m.setDemoMode(true)),
      }));
      return;
    }
    if (!env) {
      // Context may still be loading; offer manual fetch.
      container.appendChild(emptyState({
        ic: 'air', title: 'No environmental data loaded',
        message: 'Load the heat context first, or fetch parameters directly for the selected area.',
        actions: [btnGhost('Fetch Parameters', 'download', () => retryEnv(container))],
      }));
      return;
    }

    const cur = env.current || {};
    const hourly = env.hourly || {};

    // ---------- KPI cards (only non-null params) ----------
    container.appendChild(kpiGrid(cur));

    // ---------- Best Time to Go Outside (real hourly series) ----------
    container.appendChild(card({
      title: 'Best Time to Go Outside', ic: 'schedule',
      subtitle: 'Windows derived from the hourly heat-index series above',
      children: bestTimeCard(env),
    }));

    // ---------- charts ----------
    const grid = el('div', { class: 'grid gap-md mt-md', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' } });

    const hiSeries = clean(hourly.heatIndex);
    const atSeries = clean(hourly.apparentTemp);
    const wbSeries = clean(hourly.wetBulb);
    const humSeries = clean(hourly.humidity);
    const tSeries = clean(hourly.temperature);

    if (hiSeries.length || atSeries.length || wbSeries.length) {
      const len = Math.max(hiSeries.length, atSeries.length, wbSeries.length);
      grid.appendChild(card({
        title: 'Perceived Heat — Hourly', ic: 'heat_index',
        subtitle: 'Heat index · apparent temperature · wet bulb (°C)',
        children: lineChart({
          labels: Array.from({ length: len }, (_, i) => `+${i}h`),
          series: [
            { name: 'Heat index °C', color: '#f97316', points: pad(hiSeries, len) },
            { name: 'Apparent °C', color: '#2b7de9', points: pad(atSeries, len) },
            { name: 'Wet bulb °C', color: '#0e7490', points: pad(wbSeries, len) },
          ],
          yFmt: (v) => `${Math.round(v)}°`,
        }),
      }));
    }

    if (humSeries.length) {
      grid.appendChild(card({
        title: 'Relative Humidity — Hourly', ic: 'humidity_percent',
        subtitle: '% · compounding driver of perceived heat',
        children: lineChart({
          labels: humSeries.map((_, i) => `+${i}h`),
          series: [{ name: 'Humidity %', color: '#2b7de9', points: humSeries }],
          yFmt: (v) => `${Math.round(v)}%`,
        }),
      }));
    }

    if (tSeries.length) {
      grid.appendChild(card({
        title: 'Air Temperature — Hourly', ic: 'device_thermostat',
        subtitle: '°C baseline vs surface layer',
        children: lineChart({
          labels: tSeries.map((_, i) => `+${i}h`),
          series: [{ name: 'Air temp °C', color: '#ea580c', points: tSeries }],
          yFmt: (v) => `${Math.round(v)}°`,
        }),
      }));
    }

    // ---------- air quality block ----------
    if (cur.aqi != null || cur.pm25 != null || cur.no2 != null || cur.o3 != null || cur.pm10 != null) {
      const items = [
        ['AQI (composite)', cur.aqi],
        ['PM2.5 idx', cur.pm25],
        ['PM10 idx', cur.pm10],
        ['NO₂ idx', cur.no2],
        ['O₃ idx', cur.o3],
      ].filter(([, v]) => v != null).map(([label, value]) => ({ label, value: Number(value), color: aqColor(value) }));
      grid.appendChild(card({
        title: 'Air Quality Indices', ic: 'airwave',
        subtitle: 'Lower is better · FortyGuard air quality',
        children: barChart({ items, fmt: (v) => String(Math.round(v)) }),
      }));
    }

    // ---------- notes ----------
    container.appendChild(grid);
    container.appendChild(card({
      title: 'How THERMA uses these parameters', ic: 'info',
      children: el('div', { class: 'grid gap-xs text-[12px] text-on-surface-variant/90', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } },
        noteItem('device_thermostat', 'Heat index feeds exposure scoring and alert thresholds across the platform.'),
        noteItem('water_drop', 'Wet bulb temperature indicates safe work/rest cycles for outdoor operations.'),
        noteItem('wb_sunny', 'Solar irradiance explains midday surface spikes on the heat layers.'),
        noteItem('co2', 'CO₂ and methane contextualize urban combustion and landfill contributions.')),
    }));
  },
};

async function retryEnv(container, { force = false } = {}) {
  const placeId = getState().place && getState().place.id;
  if (!placeId) return;
  try {
    await loadEnvironmentFor(placeId, meanAnchor(), { force });
    rerenderScreen('environment', container);
  } catch (err) {
    toastErr(err);
  }
}

// Prefers the context-embedded environment; falls back to a standalone fetch,
// but only when it belongs to the currently selected place.
function resolveEnv(st) {
  const label = (st.place && st.place.display)
    || (st.context && st.context.location && st.context.location.display)
    || null;
  const candidates = [];
  if (st.context && st.context.environment) candidates.push(st.context.environment);
  if (st.environment) candidates.push(st.environment);
  return candidates.find((e) => !label || !e.location || e.location === label) || null;
}

function toastErr(err) {
  import('../app/widgets.js').then(({ toast }) => toast(err.message || 'Request failed.', 'error'));
}

function meanAnchor() {
  const ctx = getState().context;
  return ctx && ctx.heatmap && ctx.heatmap.stats ? ctx.heatmap.stats.mean : 30;
}

function currentPlace() {
  const st = getState();
  return (st.place && st.place.display) || 'the selected area';
}

function clean(arr) {
  return (arr || []).map(Number).filter((v) => !isNaN(v));
}

function pad(arr, len) {
  const out = [];
  for (let i = 0; i < len; i++) out.push(arr[i] != null ? arr[i] : null);
  return out;
}

const KPI_DEFS = [
  ['heatIndexC', 'Heat Index', 'device_thermostat', (v) => `${tempF(v, 1)} · ${v.toFixed(1)}°C`, 'perceived heat'],
  ['apparentTempC', 'Apparent Temp', 'thermostat', (v) => `${tempF(v, 1)} · ${v.toFixed(1)}°C`, 'feels-like'],
  ['wetBulbC', 'Wet Bulb', 'water_drop', (v) => `${v.toFixed(1)}°C · ${tempF(v, 1)}`, 'safe-work metric'],
  ['temperatureC', 'Air Temp', 'thermostat_auto', (v) => `${tempF(v, 1)}`, 'ambient'],
  ['humidity', 'Humidity', 'humidity_mid', (v) => `${Math.round(v)}%`, 'relative'],
  ['precipitation', 'Precipitation', 'rainy', (v) => `${v.toFixed(1)} mm`, 'hourly'],
  ['cloudCover', 'Cloud Cover', 'cloud', (v) => `${v} octas`, 'sky state'],
  ['aqi', 'Air Quality', 'airwave', (v) => `${Math.round(v)} AQI`, 'composite index'],
  ['co2Ppm', 'CO₂', 'co2', (v) => `${Math.round(v)} ppm`, 'combustion tracer'],
  ['solarIrradiance', 'Solar Irradiance', 'wb_sunny', (v) => `${Math.round(v)} W/m²`, 'surface driver'],
  ['methanePpb', 'Methane', 'propane_tank', (v) => `${Math.round(v)} ppb`, 'CH₄ tracer'],
];

function kpiGrid(cur) {
  const tiles = [];
  for (const [key, label, ic, fmt, sub] of KPI_DEFS) {
    const v = cur[key];
    if (v == null) continue;
    tiles.push(statTile({ label, ic, value: typeof fmt === 'function' ? fmt(v) : String(v), sub: `${sub} · fetched ${clockTime(getState().context?.fetchedAt || new Date().toISOString())}` }));
  }
  if (!tiles.length) {
    return emptyState({ ic: 'sensors_off', title: 'No parameters returned', message: 'The API returned no environmental values for this area today.' });
  }
  return el('div', { class: 'grid gap-xs', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' } }, tiles);
}

function aqColor(v) {
  return v <= 50 ? '#059669' : v <= 100 ? '#eab308' : v <= 150 ? '#f97316' : '#b91c1c';
}

function noteItem(ic, text) {
  return el('div', { class: 'flex items-start gap-2 glass-chip rounded-xl p-2.5' },
    icon(ic, 'text-[16px] text-on-surface-variant shrink-0'),
    el('span', {}, text));
}
