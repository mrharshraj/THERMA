// Layer-aware visualization pipeline.
// Every thermal layer gets its OWN color scale, legend and value formatting —
// switching layers must visibly change the rendered grid, not just the legend
// title. Values always come from the normalized FortyGuard payload; colors are
// presentation only.
//
//   selectedLayer → load layer → normalize → domain → layer scale → cells
//                 → legend → cell inspector (same layer semantics)
//
// Color families are deliberately distinct per metric:
//   temperature     — thermal band scale (server-classified bands, unchanged)
//   persistence     — sequential amber (duration above threshold, hours)
//   exceedance      — sequential violet (exceedance intensity, hours)
//   time_of_measure — cyclical time-of-day scale (peak hour 0–24)

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function lerpStops(stops, t) {
  const x = clamp01(t);
  const i = Math.min(stops.length - 2, Math.floor(x * (stops.length - 1)));
  const f = x * (stops.length - 1) - i;
  const a = stops[i][1];
  const b = stops[i + 1][1];
  const mix = (u, v) => Math.round(u + (v - u) * f);
  return `rgb(${mix((a >> 16) & 255, (b >> 16) & 255)},${mix((a >> 8) & 255, (b >> 8) & 255)},${mix(a & 255, b & 255)})`;
}

const HOUR_STOPS = [0x27272a, 0x52525b, 0xa1a1aa];                 // neutral ramp base
const PERSISTENCE_STOPS = [0xe7e5e4, 0xfbbf24, 0xea580c, 0x7c2d12]; // duration: pale → amber → deep
const EXCEEDANCE_STOPS = [0xede9fe, 0xa78bfa, 0x7c3aed, 0x4c1d95];  // intensity: pale violet → deep

// time_of_measure: cyclical day scale — night → morning → midday → dusk → night
const TIME_STOPS = [
  [0.00, 0x1e3a8a],   // 00:00 night
  [0.20, 0x4c1d95],   // ~05:00 pre-dawn
  [0.30, 0xfbbf24],   // ~07:00 morning
  [0.55, 0xf97316],   // ~13:00 midday peak
  [0.75, 0xdb2777],   // ~18:00 dusk
  [0.88, 0x6d28d9],   // ~21:00 evening
  [1.00, 0x1e3a8a],   // 24:00 night
];

function cyclicalColor(stops, t) {
  const x = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < x) i++;
  const [p0, c0] = stops[i];
  const [p1, c1] = stops[i + 1];
  const f = (x - p0) / (p1 - p0 || 1);
  const mix = (u, v) => Math.round(u + (v - u) * clamp01(f));
  return `rgb(${mix((c0 >> 16) & 255, (c1 >> 16) & 255)},${mix((c0 >> 8) & 255, (c1 >> 8) & 255)},${mix(c0 & 255, c1 & 255)})`;
}

const cToF = (c) => (c * 9) / 5 + 32;
const hourLabel = (h) => {
  const hr = Math.round(((h % 24) + 24) % 24);
  const ampm = hr < 12 ? 'AM' : 'PM';
  const base = hr % 12 === 0 ? 12 : hr % 12;
  return `${base}:00 ${ampm}`;
};

export const LAYER_IDS = ['temperature', 'persistence', 'exceedance', 'time_of_measure'];

export function layerDomain(layerId, tiles) {
  const vals = (tiles || []).map((t) => Number(t.value)).filter((v) => Number.isFinite(v));
  if (!vals.length) return { min: 0, max: 1 };
  if (layerId === 'time_of_measure') return { min: 0, max: 24 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  // keep a sensible floor so thin demo layers don't wash out
  return { min: layerId === 'temperature' ? min : Math.min(min, 0), max: Math.max(max, layerId === 'persistence' ? 6 : layerId === 'exceedance' ? 4 : 1) };
}

// Color for a normalized tile under a given layer id.
export function colorFor(layerId, tile, domain) {
  if (tile == null || tile.value == null) return '#3f3f46';
  const v = Number(tile.value);
  if (!Number.isFinite(v)) return '#3f3f46';
  const d = domain || { min: 0, max: 1 };
  switch (layerId) {
    case 'temperature':
      // server-classified thermal bands (classifyExposure) stay authoritative
      return (tile.layer && tile.layer.color) || '#f97316';
    case 'persistence': {
      const t = (v - d.min) / (d.max - d.min || 1);
      return lerpStops(PERSISTENCE_STOPS, t);
    }
    case 'exceedance': {
      const t = (v - d.min) / (d.max - d.min || 1);
      return lerpStops(EXCEEDANCE_STOPS, t);
    }
    case 'time_of_measure':
      return cyclicalColor(TIME_STOPS, v / 24);
    default:
      return (tile.layer && tile.layer.color) || '#f97316';
  }
}

// Short value formatting (tooltips, cards).
export function formatValue(layerId, v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  switch (layerId) {
    case 'temperature': return `${n.toFixed(1)}°C / ${cToF(n).toFixed(0)}°F`;
    case 'persistence': return `${n.toFixed(1)} h`;
    case 'exceedance': return `${n.toFixed(1)} h`;
    case 'time_of_measure': return hourLabel(n);
    default: return String(n);
  }
}

export function unitOf(layerId) {
  return layerId === 'temperature' ? '°C' : layerId === 'time_of_measure' ? 'hour of day' : 'hours';
}

// Legend definition for the current layer + data domain.
export function legendFor(layerId, domain) {
  const d = domain || { min: 0, max: 1 };
  switch (layerId) {
    case 'temperature':
      return {
        title: 'Surface temperature',
        stops: ['#2b7de9', '#57b1ff', '#fed7aa', '#f97316', '#b91c1c'],
        labels: ['<82°F', '86°', '90°', '95°', '>95°F'],
      };
    case 'persistence':
      return {
        title: 'Persistence — hours above threshold',
        stops: ['#e7e5e4', '#fbbf24', '#ea580c', '#7c2d12'],
        labels: [`${d.min.toFixed(0)}h`, `${(d.min + (d.max - d.min) * 0.33).toFixed(0)}h`, `${(d.min + (d.max - d.min) * 0.66).toFixed(0)}h`, `${d.max.toFixed(0)}h+`],
      };
    case 'exceedance':
      return {
        title: 'Exceedance — intensity over threshold',
        stops: ['#ede9fe', '#a78bfa', '#7c3aed', '#4c1d95'],
        labels: [`${d.min.toFixed(0)}h`, `${(d.min + (d.max - d.min) * 0.33).toFixed(0)}h`, `${(d.min + (d.max - d.min) * 0.66).toFixed(0)}h`, `${d.max.toFixed(0)}h+`],
      };
    case 'time_of_measure':
      return {
        title: 'Peak time of day',
        stops: ['#1e3a8a', '#fbbf24', '#f97316', '#db2777', '#6d28d9', '#1e3a8a'],
        labels: ['12AM', '7AM', '1PM', '6PM', '9PM', '12AM'],
      };
    default:
      return { title: 'Layer', stops: ['#888888'], labels: ['—'] };
  }
}

// Tooltip + inspector content for a tile under the current layer.
export function describeTile(layerId, tile) {
  if (!tile) return { main: '—', rows: [] };
  const rows = [];
  switch (layerId) {
    case 'temperature':
      rows.push(['Range', tile.min != null && tile.max != null ? `${cToF(tile.min).toFixed(0)}–${cToF(tile.max).toFixed(0)}°F` : '—']);
      break;
    case 'persistence':
      rows.push(['Metric', 'Hours above threshold']);
      break;
    case 'exceedance':
      rows.push(['Metric', 'Exceedance intensity (h)']);
      break;
    case 'time_of_measure':
      rows.push(['Metric', 'Hour of daily peak']);
      break;
  }
  if (tile.center) rows.push(['Location', `${Number(tile.center.lat).toFixed(4)}, ${Number(tile.center.lon).toFixed(4)}`]);
  if (tile.layer && tile.layer.band) rows.push(['Server band', tile.layer.band]);
  return { main: formatValue(layerId, tile.value), rows };
}
