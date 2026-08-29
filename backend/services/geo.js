const fs = require('fs');
const path = require('path');

const places = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'florida-places.json'), 'utf8')
);

const index = places.reduce((m, p) => {
  m[p.id] = p;
  return m;
}, {});

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_NOMINATIM_MS = 8000;

async function nominatimSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_NOMINATIM_MS);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&accept-language=en&q=${encodeURIComponent(query + ', Florida')}`,
      { headers: { 'User-Agent': 'THERMA-heat-intelligence/1.0' }, signal: controller.signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((d) => d.lat && d.lon)
      .map((d, i) => ({
        id: `osm-${i}-${Date.now()}`,
        name: d.display_name.split(',').slice(0, 2).join(',').trim(),
        display: d.display_name.split(',')[0].trim(),
        type: d.type || 'place',
        region: 'Florida',
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
        bbox: d.boundingbox
          ? [[parseFloat(d.boundingbox[2]), parseFloat(d.boundingbox[0])], [parseFloat(d.boundingbox[3]), parseFloat(d.boundingbox[1])]]
          : null,
        county: 'Florida',
        feature: 'search',
        external: true,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function reverseGeocode(lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_NOMINATIM_MS);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en&zoom=12`,
      { headers: { 'User-Agent': 'THERMA-heat-intelligence/1.0' }, signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchPlaces(query) {
  const q = normalize(query);
  if (!q) return [];
  const scored = places
    .map((p) => {
      const haystack = normalize(`${p.name} ${p.display} ${p.county} ${p.region} ${p.type}`);
      let score = 0;
      if (haystack === q) score = 100;
      else if (haystack.startsWith(q)) score = 80;
      else if (haystack.includes(q)) score = 60;
      if (normalize(p.name).startsWith(q)) score += 20;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const local = scored.slice(0, 6).map((x) => x.p);

  if (local.length < 3) {
    const external = await nominatimSearch(query);
    return [...local, ...external].slice(0, 8);
  }
  return local.slice(0, 8);
}

function placeById(id) {
  return index[id] || null;
}

function buildAoi(place, { paddingKm = 2.5, maxSideKm = Infinity } = {}) {
  let minLon, minLat, maxLon, maxLat;
  if (place.bbox) {
    [[minLon, minLat], [maxLon, maxLat]] = place.bbox;
  } else {
    minLon = place.lon - 0.03;
    maxLon = place.lon + 0.03;
    minLat = place.lat - 0.03;
    maxLat = place.lat + 0.03;
  }

  // Cap the AOI around the place center so requests stay within plan limits.
  if (maxSideKm !== Infinity) {
    const cx = (minLon + maxLon) / 2;
    const cy = (minLat + maxLat) / 2;
    const halfLat = Math.min((maxLat - minLat) / 2, maxSideKm / 111.32 / 2);
    const cosLat = Math.cos((cy * Math.PI) / 180);
    const halfLon = Math.min((maxLon - minLon) / 2, maxSideKm / (111.32 * cosLat) / 2);
    minLon = cx - halfLon; maxLon = cx + halfLon;
    minLat = cy - halfLat; maxLat = cy + halfLat;
  }

  const dLat = (paddingKm / 111.32) * 0.5;
  const dLon = (paddingKm / (111.32 * Math.cos((place.lat * Math.PI) / 180))) * 0.5;
  minLon -= dLon; maxLon += dLon;
  minLat -= dLat; maxLat += dLat;

  // Ensure the AOI stays within the bbox for curated places to control AOI size.
  const ring = [
    [minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat],
  ];
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: place.display || place.name },
        geometry: { type: 'Polygon', coordinates: [ring] },
      },
    ],
  };
}

function centerToAoi(lat, lon, sideKm = 1.5) {
  const dLat = sideKm / 111.32 / 2;
  const dLon = sideKm / (111.32 * Math.cos((lat * Math.PI) / 180)) / 2;
  const ring = [
    [lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat],
  ];
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
  };
}

module.exports = {
  places,
  index,
  searchPlaces,
  placeById,
  buildAoi,
  centerToAoi,
  reverseGeocode,
};