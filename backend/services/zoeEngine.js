// Local Zoe intelligence engine.
// Used when Gemini is unavailable AND as a grounded fallback when Gemini fails.
// Zoe is THERMA-scoped: it refuses unrelated general-knowledge questions and
// answers exclusively from the application context passed by the frontend.

const REFUSAL = "I'm Zoe, THERMA's heat-intelligence assistant. I can only help with THERMA, its heat data, maps, routes, risk analysis, environmental intelligence, and application tasks.";

const NAV_SCREENS = [
  { key: 'overview', words: ['overview', 'command center', 'dashboard', 'home'], label: 'Overview', route: 'overview' },
  { key: 'heat', words: ['heat intelligence', 'intelligence', 'heat analysis'], label: 'Heat Intelligence', route: 'heat' },
  { key: 'coolroute', words: ['coolroute', 'cool route', 'route planner', 'thermal routing'], label: 'CoolRoute', route: 'coolroute' },
  { key: 'scenarios', words: ['scenario'], label: 'Scenarios', route: 'scenarios' },
  { key: 'urban', words: ['urban', 'property'], label: 'Urban & Property', route: 'urban' },
  { key: 'logistics', words: ['logistic'], label: 'Logistics', route: 'logistics' },
  { key: 'facilities', words: ['facilit'], label: 'Facilities', route: 'facilities' },
  { key: 'utilities', words: ['utilit', 'infrastructure'], label: 'Utilities', route: 'utilities' },
  { key: 'risk', words: ['risk', 'insurance'], label: 'Risk & Insurance', route: 'risk' },
  { key: 'portfolio', words: ['portfolio', 'asset'], label: 'Portfolio', route: 'portfolio' },
  { key: 'environment', words: ['environment'], label: 'Environment', route: 'environment' },
  { key: 'alerts', words: ['alert'], label: 'Alerts', route: 'alerts' },
  { key: 'reports', words: ['report'], label: 'Reports', route: 'reports' },
  { key: 'settings', words: ['setting'], label: 'Settings', route: 'settings' },
  { key: 'search', words: ['search', 'find location'], label: 'Global Search', route: 'search' },
  { key: 'workspace', words: ['decision workspace', 'decision center', 'workspace'], label: 'Decision Workspace', route: 'workspace' },
  { key: 'explorer', words: ['map explorer', 'explorer'], label: 'Map Explorer', route: 'explorer' },
];

const LAYERS = {
  temperature: ['temperature', 'tcm', 'temp layer'],
  persistence: ['persistence', 'persist'],
  exceedance: ['exceedance', 'exceeding'],
  peak: ['peak time', 'peak', 'time of measure'],
  environment: ['environment layer', 'humidity layer'],
  risk: ['risk layer', 'risk overlay'],
  satellite: ['satellite'],
  street: ['street view', 'street context'],
};

const UNIT_KEYS = ['celsius', 'fahrenheit', 'metric', 'imperial'];

function unify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function has(text, ...words) {
  const t = unify(text);
  return words.some((w) => t.includes(unify(w)));
}

function action(name, args = {}) {
  return { name, args };
}

function openZoe(message) {
  return { message, intent: 'open_zoe', actions: [action('open_zoe')], visualization: { type: 'text_only' } };
}

function findScreen(text) {
  for (const s of NAV_SCREENS) {
    if (has(text, ...s.words)) return s;
  }
  return null;
}

function matchLocation(text, ctx) {
  const allowed = ['miami beach', 'south beach', 'downtown miami', 'miami', 'brickell', 'wynwood', 'little havana', 'little haiti', 'design district', 'overtown', 'liberty city', 'coconut grove', 'coral gables', 'kendall', 'hialeah', 'doral', 'aventura', 'homestead', 'fort lauderdale', 'hollywood', 'pompano', 'orlando', 'kissimmee', 'tampa', 'st. petersburg', 'clearwater', 'jacksonville', 'tallahassee', 'gainesville', 'pensacola', 'west palm beach', 'boca raton', 'fort myers', 'naples', 'sarasota', 'daytona', 'melbourne', 'key west', 'beach', 'florida'];
  const t = unify(text);
  for (const loc of allowed) {
    if (t.includes(loc)) return loc;
  }
  return null;
}

function topHotAreas(ctx, limit = 3) {
  const areas = (ctx.heat && ctx.heat.topAreas) || ctx.topAreas || [];
  return areas.slice(0, limit);
}

function hottestResponse(ctx, text) {
  const areas = topHotAreas(ctx);
  if (areas && areas.length) {
    const first = areas[0];
    const list = areas
      .map((a, i) => `${i + 1}. ${a.label} — ${a.tempF ? a.tempF.toFixed(0) + '°F' : a.valueC ? a.valueC.toFixed(1) + '°C' : 'est. peak'}`)
      .join('  •  ');
    return {
      message: `Based on the current ${ctx.location ? ctx.location.display : 'selected'} heat layer, the hottest zone is ${first.label} (est. ${first.tempF ? first.tempF.toFixed(0) + '°F' : first.valueC ? first.valueC.toFixed(1) + '°C' : 'peak'}). Top areas: ${list}. I've highlighted it on the map.`,
      intent: 'hottest_area',
      actions: [action('run_heat_analysis', { layer: ctx.activeLayer || 'temperature' }), action('show_visualization', { type: 'map_graph', mode: 'hottest' })],
      visualization: { type: 'map_graph', config: { mode: 'hottest' } },
    };
  }
  return {
    message: "I'll run a heat analysis for the selected area so I can identify the hottest zone.",
    intent: 'hottest_area',
    actions: [action('run_heat_analysis', { layer: 'temperature' }), action('show_visualization', { type: 'map', mode: 'heat' })],
    visualization: { type: 'map', config: { mode: 'heat' } },
  };
}

function whyRiskResponse(ctx) {
  const exp = ctx.exposure || {};
  const env = ctx.environment && ctx.environment.current ? ctx.environment.current : {};
  const drivers = exp.drivers && exp.drivers.length ? exp.drivers : [];
  const parts = [
    exp.temperature != null ? `Surface estimates around ${((exp.temperature * 9) / 5 + 32).toFixed(0)}°F in this zone` : 'Elevated surface estimates in this zone',
  ];
  if (env.heatIndexC != null && exp.temperature != null && env.heatIndexC - exp.temperature > 2) parts.push('heat index running above air temperature');
  if (env.humidity != null && env.humidity >= 60) parts.push(`humidity near ${Math.round(env.humidity)}%`);
  if (exp.persistent != null) parts.push('long-duration persistence of heat');
  return {
    message: `This area rates ${exp.level || 'elevated'} risk because: ${parts.join('; ')}. ${drivers.length ? 'Key drivers: ' + drivers.join(', ') + '.' : ''} The flowchart shows the reasoning chain.`,
    intent: 'why_risk',
    actions: [action('show_visualization', { type: 'map_graph_flowchart', mode: 'risk' })],
    visualization: { type: 'map_graph_flowchart', config: { mode: 'risk' } },
  };
}

// ---- route reasoning over the ACTUAL analyzed payload -----------------------
// ctx.routes = { from, to, mode, selectedRouteId, options: [...] } with full
// exposure objects. Every number below is computed from that payload.
function routeMetrics(ctx) {
  const R = ctx.routes || {};
  const options = Array.isArray(R.options) ? R.options : [];
  const withExp = options.filter((r) => r.exposure);
  const fastest = [...options].sort((a, b) => a.durationSeconds - b.durationSeconds)[0] || null;
  const coolest = withExp.length
    ? [...withExp].sort((a, b) => a.exposure.meanF - b.exposure.meanF)[0]
    : null;
  const selected = options.find((r) => r.id === R.selectedRouteId) || coolest || fastest;
  return { R, options, withExp, fastest, coolest, selected };
}

const minOf = (s) => Math.round(s / 60);

function routeCompareResponse(ctx, text) {
  const { R, options, withExp, fastest, coolest, selected } = routeMetrics(ctx);

  // "which segment is hottest" — answerable from a single analyzed route
  if (has(text, 'segment') && selected && selected.exposure && selected.exposure.peakSegment) {
    const t = selected.exposure.peakSegment;
    return {
      message: `On ${selected.label || selected.id}, the hottest stretch is segment ${t.index + 1} of 6 — averaging ${Number(t.avgF).toFixed(0)}°F (${t.band} band) out of ${selected.exposure.sampledPoints} sampled points along the corridor.`,
      intent: 'route_segment',
      actions: [action('show_visualization', { type: 'map_graph', mode: 'routes' })],
      visualization: { type: 'map_graph', config: { mode: 'routes' } },
    };
  }

  if (options.length < 2) {
    return {
      message: 'Open CoolRoute and run an analysis first — then I can compare thermal exposure, timing and the peak segments between the real alternatives.',
      intent: 'route_compare',
      actions: [action('navigate_to', { screen: 'coolroute' }), action('show_visualization', { type: 'map', mode: 'routes' })],
      visualization: { type: 'map', config: { mode: 'routes' } },
    };
  }

  const head = `Analyzed ${options.length} ${R.mode || 'driving'} alternatives from ${R.from && R.from.name ? R.from.name : 'origin'} to ${R.to && R.to.name ? R.to.name : 'destination'}:`;

  if (!withExp.length) {
    return {
      message: `${head} ${options.map((r) => `${r.label || r.id} ${minOf(r.durationSeconds)} min / ${(r.distanceMeters / 1000).toFixed(1)} km`).join(' · ')}. Thermal association is unavailable for this corridor, so compare on time and distance only.`,
      intent: 'route_compare',
      actions: [action('show_visualization', { type: 'map_graph', mode: 'routes' })],
      visualization: { type: 'map_graph', config: { mode: 'routes' } },
    };
  }

  // WHY ISN'T FASTEST BEST / which should I take — computed trade-off
  if (coolest && fastest && coolest.id === fastest.id) {
    return {
      message: `${head} the fastest option (${coolest.label || coolest.id}, ${minOf(coolest.durationSeconds)} min) is ALSO the coolest at ${coolest.exposure.meanF.toFixed(1)}°F average exposure (${coolest.exposure.band}) — no trade-off today, take it.`,
      intent: 'route_compare',
      actions: [action('run_route_analysis', {}), action('show_visualization', { type: 'map_graph', mode: 'routes' })],
      visualization: { type: 'map_graph', config: { mode: 'routes' } },
    };
  }

  const dMin = minOf(coolest.durationSeconds - fastest.durationSeconds);
  const dF = fastest.exposure ? fastest.exposure.meanF - coolest.exposure.meanF : null;
  const pct = fastest.exposure && fastest.exposure.score
    ? Math.round(((fastest.exposure.score - coolest.exposure.score) / fastest.exposure.score) * 100)
    : null;
  const seg = coolest.exposure.peakSegment;
  const segTxt = seg ? ` Its warmest stretch is segment ${seg.index + 1} at ${Number(seg.avgF).toFixed(0)}°F (${seg.band}).` : '';

  return {
    message: `${head} ${coolest.label || coolest.id} is the coolest (${coolest.exposure.meanF.toFixed(1)}°F avg, ${coolest.exposure.band}); ${fastest.label || fastest.id} is fastest (${minOf(fastest.durationSeconds)} min${fastest.exposure ? `, but ${fastest.exposure.meanF.toFixed(1)}°F avg` : ''}). Recommendation: ${coolest.label || coolest.id} — it adds ${dMin} min versus the fastest while running ${dF != null ? dF.toFixed(1) + '°F cooler' : 'cooler'}${pct > 0 ? ` (≈${pct}% lower exposure score)` : ''}.${segTxt} FASTEST ≠ BEST when the exposure gap outweighs the minutes.`,
    intent: 'route_compare',
    actions: [action('run_route_analysis', {}), action('show_visualization', { type: 'map_graph', mode: 'routes' })],
    visualization: { type: 'map_graph', config: { mode: 'routes' } },
  };
}

function alertsResponse(ctx) {
  const alerts = ctx.alerts || [];
  if (alerts.length) {
    const active = alerts.filter((a) => a.status !== 'resolved');
    return {
      message: `There ${active.length === 1 ? 'is' : 'are'} ${active.length} active alert${active.length === 1 ? '' : 's'}: ${active.slice(0, 4).map((a) => `${a.severity} — ${a.type} at ${a.location}`).join('; ')}${active.length > 4 ? '; and more.' : ''} Most critical: ${active[0].severity} ${active[0].type} at ${active[0].location}.`,
      intent: 'alerts',
      actions: [action('open_alert', { id: active[0].id }), action('show_visualization', { type: 'graph', mode: 'alerts' })],
      visualization: { type: 'graph', config: { mode: 'alerts' } },
    };
  }
  return {
    message: "No active alerts are present in the current context. Alerts are generated by THERMA rules from the monitored heat data.",
    intent: 'alerts',
    actions: [],
    visualization: { type: 'text_only' },
  };
}

function temperatureResponse(ctx) {
  const stats = ctx.heat && ctx.heat.stats;
  const env = ctx.environment && ctx.environment.current ? ctx.environment.current : {};
  let msg = `Current${ctx.location ? ' ' + ctx.location.display : ''} heat context: `;
  if (stats && stats.mean != null) msg += `mean surface estimate ${stats.mean.toFixed(1)}°C (${((stats.mean * 9) / 5 + 32).toFixed(0)}°F), peak ${stats.max != null ? stats.max.toFixed(1) + '°C' : 'n/a'}. `;
  else msg += 'heat layer not loaded yet. ';
  if (env.heatIndexC != null) msg += `Heat index ${env.heatIndexC.toFixed(1)}°C, humidity ${Math.round(env.humidity || 0)}%.`;
  return {
    message: msg.trim(),
    intent: 'temperature',
    actions: [action('show_visualization', { type: 'map', mode: 'temperature' })],
    visualization: { type: 'map', config: { mode: 'temperature' } },
  };
}

function priorityResponse(ctx) {
  const assets = ctx.assets || [];
  const ranked = assets.filter((a) => a.risk && a.risk.index >= 4).slice(0, 3);
  if (ranked.length) {
    return {
      message: `Priority ranking from app data: 1) ${ranked[0].name} (${ranked[0].risk.band}), 2) ${ranked[1] ? ranked[1].name + ' (' + ranked[1].risk.band + ')' : ''}, 3) ${ranked[2] ? ranked[2].name + ' (' + ranked[2].risk.band + ')' : ''}. Top-listed assets face the most sustained exposure.`,
      intent: 'priority',
      actions: [action('open_asset', { id: ranked[0].id }), action('show_visualization', { type: 'map_graph_flowchart', mode: 'priority' })],
      visualization: { type: 'map_graph_flowchart', config: { mode: 'priority' } },
    };
  }
  return {
    message: "I can rank priorities once assets and heat data are loaded for the selected area.",
    intent: 'priority',
    actions: [action('run_heat_analysis', { layer: 'temperature' })],
    visualization: { type: 'map', config: { mode: 'priority' } },
  };
}

function envResponse(ctx) {
  const env = ctx.environment && ctx.environment.current ? ctx.environment.current : {};
  const has = Object.keys(env).length > 0;
  if (has) {
    return {
      message: `Environmental conditions: heat index ${env.heatIndexC != null ? env.heatIndexC.toFixed(1) + '°C' : 'n/a'}, apparent temperature ${env.apparentTempC != null ? env.apparentTempC.toFixed(1) + '°C' : 'n/a'}, humidity ${env.humidity != null ? Math.round(env.humidity) + '%' : 'n/a'}, AQI ${env.aqi != null ? Math.round(env.aqi) : 'n/a'}, solar irradiance ${env.solarIrradiance != null ? Math.round(env.solarIrradiance) + ' W/m²' : 'n/a'}.`,
      intent: 'environment',
      actions: [action('run_environment_analysis', {}), action('show_visualization', { type: 'graph', mode: 'environment' })],
      visualization: { type: 'graph', config: { mode: 'environment' } },
    };
  }
  return {
    message: "Environmental parameters aren't loaded for this area yet. I can run an environmental analysis to get heat index, humidity, and air quality.",
    intent: 'environment',
    actions: [action('run_environment_analysis', {}), action('show_visualization', { type: 'graph', mode: 'environment' })],
    visualization: { type: 'graph', config: { mode: 'environment' } },
  };
}

// ---- best time to go outside (real hourly heat-index series) ----------------
// Thresholds mirror the frontend implementation (app/besttime.js): good < 30°C
// heat index, caution 30–33°C, high risk >= 33°C. Operational guidance only.
const BT_GOOD = 30;
const BT_HIGH = 33;

function btLabel(h) {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? 'AM' : 'PM';
  const base = hr % 12 === 0 ? 12 : hr % 12;
  return `${base} ${ampm}`;
}

function bestTimeResponse(ctx) {
  const hourly = ctx.environment && ctx.environment.hourly;
  const series = hourly && Array.isArray(hourly.heatIndex) && hourly.heatIndex.length
    ? hourly.heatIndex
    : (hourly && Array.isArray(hourly.temperature) ? hourly.temperature : null);
  if (!series) {
    return {
      message: "I need the hourly environmental series to find the best outdoor window. Let me run the environmental analysis first.",
      intent: 'best_time',
      actions: [action('run_environment_analysis', {}), action('navigate_to', { screen: 'environment' })],
      visualization: { type: 'graph', config: { mode: 'environment' } },
    };
  }
  const cats = series.map((v) => (v == null ? null : v < BT_GOOD ? 'good' : v < BT_HIGH ? 'caution' : 'high'));
  const runs = [];
  let cur = null;
  cats.forEach((c, i) => {
    if (c && cur && cur.category === c && i === cur.to + 1) cur.to = i;
    else {
      if (cur) runs.push(cur);
      cur = c ? { category: c, from: i, to: i } : null;
    }
  });
  if (cur) runs.push(cur);
  const pick = (cat) => runs.filter((r) => r.category === cat).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0] || null;
  const best = pick('good');
  const high = pick('high');
  const peakVal = Math.max(...series.filter((v) => v != null));
  const peakIdx = series.findIndex((v) => v === peakVal);
  const f = (c) => Math.round((c * 9) / 5 + 32);
  const parts = [];
  if (best) parts.push(`best outdoor window is ${btLabel(best.from)} to ${btLabel(best.to + 1)} (heat index below ${f(BT_GOOD)}°F)`);
  else parts.push(`no fully suitable window today — heat index stays at or above ${f(BT_GOOD)}°F`);
  if (high) parts.push(`high-risk stretch ${btLabel(high.from)} to ${btLabel(high.to + 1)}`);
  parts.push(`conditions peak near ${btLabel(peakIdx)} at about ${f(peakVal)}°F heat index`);
  return {
    message: `From the hourly environmental data: ${parts.join('; ')}. Opening the Environment screen with the full 24-hour breakdown — operational guidance, not medical advice.`,
    intent: 'best_time',
    actions: [action('run_environment_analysis', {}), action('navigate_to', { screen: 'environment' })],
    visualization: { type: 'graph', config: { mode: 'environment' } },
  };
}

function cellInspectResponse(ctx) {
  const cell = ctx.selectedCell;
  if (cell && cell.id != null) {
    const val = cell.units === 'hour'
      ? `${Number(cell.valueC).toFixed(1)}h exposure`
      : `${Number(cell.valueC).toFixed(1)}°C (${cell.tempF != null ? Math.round(cell.tempF) + '°F' : 'n/a'})`;
    const where = cell.center ? ` at ${Number(cell.center.lat).toFixed(4)}, ${Number(cell.center.lon).toFixed(4)}` : '';
    return {
      message: `Selected cell ${cell.id}: ${val}${where}${cell.band ? ` — ${cell.band} band` : ''}. Values come straight from the loaded heat layer; open Heat Intelligence to inspect neighbors.`,
      intent: 'cell_inspect',
      actions: [action('navigate_to', { screen: 'heat' })],
      visualization: { type: 'map', config: { mode: 'layer' } },
    };
  }
  return {
    message: "No cell is selected yet. Open Heat Intelligence and click any colored cell — then ask me again and I'll read out its actual values.",
    intent: 'cell_inspect',
    actions: [action('navigate_to', { screen: 'heat' })],
    visualization: { type: 'text_only' },
  };
}

function scenarioResponse(ctx) {
  return {
    message: "I've prepared the scenario workspace. Change the time window, route, or add an intervention and THERMA will estimate the thermal outcome. Results are labeled 'THERMA SCENARIO ESTIMATE' — not raw sensor data.",
    intent: 'scenario',
    actions: [action('create_scenario', {}), action('navigate_to', { screen: 'scenarios' })],
    visualization: { type: 'map_graph', config: { mode: 'scenario' } },
  };
}

// Extracts an explicit hour range from phrasing like "from 08:00 to 16:00",
// "between 8am and 4pm", "8 to 16". Returns null when the user named no window,
// so the Reports screen selection stays in control.
function parseReportWindow(text) {
  const t = String(text || '').toLowerCase();
  const hour = (raw, meridiem) => {
    let h = parseInt(raw, 10);
    if (!Number.isFinite(h)) return null;
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return h >= 0 && h <= 23 ? h : null;
  };
  const re = /(?:from|between)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|till|through|-|–|and)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/;
  const m = re.exec(t);
  if (!m) return null;
  const start = hour(m[1], m[3]);
  const end = hour(m[4], m[6]);
  if (start == null || end == null) return null;
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  return { start: s, end: e, duration: e - s + 1 };
}

function reportResponse(ctx, text) {
  const win = parseReportWindow(text);
  const hhmm = (h) => `${String(h).padStart(2, '0')}:00`;
  return {
    message: win
      ? `Generating a heat intelligence report for ${hhmm(win.start)} – ${hhmm(win.end)} (${win.duration} hourly observations), including heat stats, environmental parameters, asset risk, alerts, and recommendations.`
      : "I can generate a heat intelligence report for the current selection, including heat stats, environmental parameters, asset risk, alerts, and recommendations. Tell me an hour range (for example \"from 08:00 to 16:00\") to scope the analysis window.",
    intent: 'report',
    actions: [action('generate_report', win ? { window: win } : {}), action('navigate_to', { screen: 'reports' })],
    visualization: { type: 'text_only' },
  };
}

function decisionResponse(ctx) {
  return {
    message: 'Opening the Decision Workspace with map, graph, and reasoning views so you can compare options side by side.',
    intent: 'decision',
    actions: [action('open_decision_workspace', { mode: 'split' })],
    visualization: { type: 'map_graph_flowchart', config: { mode: 'split' } },
  };
}

function outOfScope() {
  return {
    message: REFUSAL,
    intent: 'out_of_scope',
    actions: [],
    visualization: { type: 'text_only' },
  };
}

// Main dispatch ---------------------------------------------------------------

function answer(message, ctx = {}) {
  const text = unify(message);
  if (!text) return outOfScope();

  // ----- Strict out-of-scope policy -----------------------------------
  const gk = [
    'who is', 'prime minister', 'world cup', 'is python', 'write me a poem', 'tell me a joke',
    'weather in london', 'weather in paris', 'history of', 'capital of', 'recipe for', 'what is the meaning of life',
    'president of india', 'translate', 'math: ', 'solve 5', 'who won the oscar', 'football match', 'cricket',
    'general knowledge', 'news today', 'stock market', 'cryptocurrency', 'donald trump', 'election',
  ];
  if (gk.some((k) => text.includes(k)) && !text.includes('therma') && !text.includes('heat')) {
    return outOfScope();
  }

  // ----- Greetings / help -------------------------------------------------
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(text) || text === 'hi') {
    return {
      message: `Hi! I'm Zoe, THERMA's heat-intelligence assistant${ctx.location ? ' for ' + ctx.location.display : ''}. Ask me about heat layers, hotspots, routes, risk, alerts, or tell me to open a screen — I can operate the app for you.`,
      intent: 'greeting', actions: [], visualization: { type: 'text_only' },
    };
  }
  if (has(text, 'what can you do', 'help', 'capabilities', 'how does this work', 'tutorial')) {
    return {
      message: 'I can answer THERMA questions with maps, graphs, and reasoning flows; navigate screens; switch map layers; run heat/route/environment analysis; compare locations; generate reports; and more. Try "Which area is hottest?" or "Open CoolRoute".',
      intent: 'help', actions: [], visualization: { type: 'text_only' },
    };
  }

  // ----- App control -------------------------------------------------------
  if (has(text, 'open zoe', 'come back', 'show the zoe panel') || /\bzo(e|y)\b\s*(open|show)\b/.test(text)) return openZoe('Opening my panel — ask away.');
  if (has(text, 'close zoe', 'hide zoe', 'hide the zoe panel')) {
    return { message: 'Closing my panel. The workspace will expand.', intent: 'close_zoe', actions: [action('close_zoe')], visualization: { type: 'text_only' } };
  }
  if (has(text, 'open sidebar', 'show sidebar')) return { message: 'Opening the navigation sidebar.', intent: 'sidebar', actions: [action('open_sidebar')], visualization: { type: 'text_only' } };
  if (has(text, 'close sidebar', 'hide sidebar', 'collapse sidebar')) return { message: 'Collapsed the sidebar — the main workspace expands.', intent: 'sidebar', actions: [action('close_sidebar')], visualization: { type: 'text_only' } };
  // THERMA is dark-only: no light/dark/system switching exists, so theme
  // requests get an explicit refusal instead of a (removed) set_theme action.
  if (has(text, 'dark mode', 'dark theme', 'light mode', 'light theme', 'system theme', 'system mode', 'switch theme', 'change theme')) {
    return { message: 'THERMA ships a single dark control-room palette — there is no light mode or theme switching to change.', intent: 'theme', actions: [], visualization: { type: 'text_only' } };
  }
  if (has(text, 'zoom in')) return { message: 'Zooming in.', intent: 'zoom', actions: [action('zoom_map', { delta: 1 })], visualization: { type: 'text_only' } };
  if (has(text, 'zoom out')) return { message: 'Zooming out.', intent: 'zoom', actions: [action('zoom_map', { delta: -1 })], visualization: { type: 'text_only' } };
  if (has(text, 'reset map', 'reset view', 'fit map')) return { message: 'Resetting the map view.', intent: 'reset', actions: [action('reset_map')], visualization: { type: 'text_only' } };
  if (has(text, 'fullscreen') || /\bfull ?screen\b/.test(text)) return { message: 'Toggling fullscreen for the map.', intent: 'fullscreen', actions: [action('zoom_map', { fullscreen: true })], visualization: { type: 'text_only' } };

  // ----- Location ------------------------------------------------------------
  const loc = matchLocation(message, ctx);
  if (loc) {
    return {
      message: `Switching THERMA context to ${loc}. Updating the map, metrics, and analysis views.`,
      intent: 'location', actions: [action('select_location', { query: loc }), action('run_heat_analysis', { layer: ctx.activeLayer || 'temperature' })],
      visualization: { type: 'map', config: { mode: 'location' } },
    };
  }

  // ----- Layer control --------------------------------------------------------
  for (const [layer, words] of Object.entries(LAYERS)) {
    if (has(text, ...words) && has(text, 'layer', 'show', 'view', 'display', 'switch', 'turn')) {
      return {
        message: `Switching the map to the ${layer} ${layer === 'peak' ? 'time' : ''} layer.`,
        intent: 'layer', actions: [action('set_map_layer', { layer })],
        visualization: { type: 'map', config: { mode: 'layer', layer } },
      };
    }
  }

  // ----- Core queries ---------------------------------------------------------
  // Route-segment questions must be matched before the generic "hottest" zone
  // matcher (both contain "hottest").
  if (has(text, 'segment') && has(text, 'route', 'my route', 'corridor')) return routeCompareResponse(ctx, text);
  if (has(text, 'hottest', 'hot area', 'hot zone', 'which area is hot', 'peak zone', 'most exposed')) return hottestResponse(ctx, text);
  if (has(text, 'best time', 'go outside', 'go out', 'when should i go', 'safe to be outside', 'outdoor window', 'when is it safe outside')) return bestTimeResponse(ctx);
  if (has(text, 'inspect', 'this cell', 'selected cell', 'cell detail') && has(text, 'cell', 'inspect')) return cellInspectResponse(ctx);
  if (has(text, 'why', 'reason', 'cause') && has(text, 'risk', 'hot', 'exposure')) return whyRiskResponse(ctx);
  if (has(text, 'compare', 'vs', 'versus') && (has(text, 'area', 'location', 'zone', 'route', 'asset'))) {
    return {
      message: 'Opening the Decision Workspace in comparison mode so you can evaluate options side by side — map, graph, and reasoning views included.',
      intent: 'compare', actions: [action('compare_locations', {}), action('open_decision_workspace', { mode: 'comparison' })],
      visualization: { type: 'map_graph_flowchart', config: { mode: 'comparison' } },
    };
  }
  if (has(text, 'coolest route', 'cool route', 'route') || (has(text, 'route') && has(text, 'heat', 'cool'))
      || has(text, 'which route', 'why is this route', 'why isnt the fastest', 'why is the fastest', 'how much cooler', 'which segment')) {
    return routeCompareResponse(ctx, text);
  }
  if (has(text, 'coolroute', 'navigate route')) {
    return { message: 'Opening CoolRoute. Enter origin, destination, departure and mode, then analyze to compare fastest, balanced, and coolest alternatives.', intent: 'route_open', actions: [action('navigate_to', { screen: 'coolroute' })], visualization: { type: 'map', config: { mode: 'routes' } } };
  }
  if (has(text, 'alert')) return alertsResponse(ctx);
  if (has(text, 'temperature', 'temp', 'how hot', 'degrees', '°c', '°f')) return temperatureResponse(ctx);
  if (has(text, 'priority', 'prioritize', 'what should i focus')) return priorityResponse(ctx);
  if (has(text, 'environment', 'humidity', 'air quality', 'air quality', 'aqi', 'solar', 'wet bulb')) return envResponse(ctx);
  if (has(text, 'scenario', 'what if', 'intervention')) return scenarioResponse(ctx);
  if (has(text, 'report', 'export')) return reportResponse(ctx, text);
  if (has(text, 'decision', 'workspace', 'compare locations')) return decisionResponse(ctx);

  // ----- Navigation --------------------------------------------------------
  const screen = findScreen(text);
  if (screen) {
    return {
      message: `Opening ${screen.label}.`,
      intent: 'navigate', actions: [action('navigate_to', { screen: screen.route })],
      visualization: { type: 'text_only' },
    };
  }

  // ----- Asset-level questions -----------------------------------------------
  if (has(text, 'asset', 'facility', 'building', 'site') && (has(text, 'risk', 'temp', 'hot', 'status'))) {
    const assets = ctx.assets || [];
    if (assets.length) {
      const worst = assets.filter((a) => a.risk).sort((a, b) => (b.risk.index || 0) - (a.risk.index || 0))[0];
      return {
        message: `From monitored assets, the highest-risk one is ${worst.name} (${worst.risk.band}, est. ${worst.tempF}°F). Asset heat values are derived from the loaded heat layer.`,
        intent: 'asset', actions: [action('open_asset', { id: worst.id }), action('show_visualization', { type: 'map_graph', mode: 'assets' })],
        visualization: { type: 'map_graph', config: { mode: 'assets' } },
      };
    }
  }

  // ----- In-scope but ambiguous ------------------------------------------------
  return {
    message: `I'm Zoe, THERMA's heat-intelligence assistant, and I'm focused on this application. I can help you with maps, layers (temperature, persistence, exceedance, peak time), hotspots, routes, scenarios, facilities, risk, portfolios, alerts, reports, and app navigation${
      ctx.screen ? ' while you are in ' + ctx.screen : ''
    }. Try: "Which area is hottest?", "Why is it high risk?", "Open CoolRoute", or "Show the persistence layer".`,
    intent: 'fallback', actions: [], visualization: { type: 'text_only' },
  };
}

module.exports = { answer, REFUSAL };