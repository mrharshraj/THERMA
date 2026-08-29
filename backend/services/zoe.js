const gemini = require('./gemini');
const engine = require('./zoeEngine');

const ALLOWED_ACTIONS = new Set([
  'navigate_to', 'select_location', 'set_map_layer', 'zoom_map', 'reset_map',
  'open_zoe', 'close_zoe', 'open_sidebar', 'close_sidebar',
  'run_heat_analysis', 'run_environment_analysis', 'run_route_analysis',
  'create_scenario', 'compare_locations', 'open_asset', 'open_property',
  'open_facility', 'open_alert', 'open_report', 'generate_report',
  'open_decision_workspace', 'show_visualization',
]);

const ROLE_CONFIG = {
  government: {
    label: "City / Government",
    priority: "public safety",
    terminology: ["neighborhood", "infrastructure", "vulnerable areas", "emergency planning", "alerts"],
    suggestions: [
      "Which area is hottest?",
      "Show critical zones.",
      "Open alerts.",
      "Generate a public safety report.",
    ],
    emphasis: ["heat zones", "alerts", "infrastructure exposure"],
    relevantScreens: ["heat", "alerts", "workspace", "reports"],
  },
  business: {
    label: "Business / Operations",
    priority: "workforce safety",
    terminology: ["workforce", "logistics", "route exposure", "operational continuity", "facilities"],
    suggestions: [
      "Find the coolest route?",
      "When should outdoor work happen?",
      "Open Facilities.",
      "Analyze this corridor.",
    ],
    emphasis: ["CoolRoute", "facilities", "logistics"],
    relevantScreens: ["coolroute", "facilities", "logistics", "workspace"],
  },
  property: {
    label: "Property / Asset Manager",
    priority: "asset risk",
    terminology: ["property", "asset", "portfolio exposure", "insurance risk", "tenant safety"],
    suggestions: [
      "Which assets have the highest exposure?",
      "Open Portfolio.",
      "Show property risk.",
    ],
    emphasis: ["asset exposure", "portfolio", "insurance"],
    relevantScreens: ["portfolio", "location", "workspace", "reports"],
  },
  emergency: {
    label: "Emergency / Safety",
    priority: "rapid response",
    terminology: ["critical zones", "exposed population", "alerts", "rapid response", "safe route"],
    suggestions: [
      "Show critical alerts?",
      "Where is the highest risk?",
      "Find the safest route.",
    ],
    emphasis: ["alerts", "critical zones", "safer routes"],
    relevantScreens: ["alerts", "heat", "workspace"],
  },
  research: {
    label: "Research / Analyst",
    priority: "data and methodology",
    terminology: ["assumptions", "methodology", "scenarios", "environmental parameters", "comparisons"],
    suggestions: [
      "Explain this thermal layer?",
      "Show persistence?",
      "Explain the assumptions?",
      "Open Environment.",
    ],
    emphasis: ["analysis", "assumptions", "scenarios", "environment"],
    relevantScreens: ["heat", "environment", "scenarios", "workspace"],
  },
  all_tools: {
    label: "All Tools",
    priority: "unrestricted access",
    terminology: ["full operational capability"],
    suggestions: [
      "Open Heat Intelligence.",
      "Run heat analysis.",
      "Open CoolRoute.",
      "Generate report.",
      "Show alerts.",
      "Show environment.",
      "Open Decision Workspace.",
    ],
    emphasis: ["full capability"],
    relevantScreens: ["heat", "coolroute", "environment", "alerts", "reports", "workspace"],
    availableActions: [
      "navigate_to", "select_location", "set_map_layer", "zoom_map", "reset_map",
      "open_zoe", "close_zoe", "open_sidebar", "close_sidebar",
      "run_heat_analysis", "run_environment_analysis", "run_route_analysis",
      "create_scenario", "compare_locations", "open_asset", "open_property", "open_facility",
      "open_alert", "open_report", "generate_report", "open_decision_workspace", "show_visualization",
    ],
  },
};

function roleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG.all_tools;
}

const SYSTEM_PROMPT = `You are Zoe, the dedicated AI operator for THERMA, an AI-powered heat-intelligence application focused primarily on Florida and Miami.

Your purpose is to help users understand and operate THERMA by executing real application actions.

You may answer questions only when they are directly relevant to: THERMA, heat intelligence, thermal conditions, environmental conditions available inside THERMA, heat risk, routes, CoolRoute, scenarios, properties, facilities, utilities, logistics, risk, portfolio, alerts, reports, maps, visualizations, settings, navigation, and application actions.

You must not act as a general-purpose assistant. If a user asks an unrelated question (general knowledge, news, weather outside THERMA, writing, jokes, math unrelated to THERMA, politics, sports, etc.), refuse and respond exactly: "I'm Zoe, THERMA's heat-intelligence assistant. I can only help with THERMA, its heat data, maps, routes, risk analysis, environmental intelligence, and application tasks."

Never invent FortyGuard measurements. Never invent API results. Never claim a THERMA estimate is raw FortyGuard data.

Clearly distinguish: FORTYGUARD DATA, THERMA ANALYSIS, ZOE RECOMMENDATION, THERMA SCENARIO ESTIMATE.

Derive all numbers ONLY from the provided "current_application_context" JSON. If the context lacks data for the question, say the data is not loaded yet and optionally issue run_* actions.

The context includes environment.hourly — a 24-hour series of heat_index / temperature / humidity / wet_bulb arrays. For "best time to go outside" style questions, derive the answer from that series (good < 30°C heat index, caution 30–33°C, high risk >= 33°C) and never invent hour values.

The context includes selectedRole (one of: government, business, property, emergency, research — or "all", the platform/demo mode with neutral emphasis). Tailor EMPHASIS to it — routes/logistics/facilities for business, public risk and infrastructure for government, portfolio and asset exposure for property, alerts and response priorities for emergency, analysis depth and comparisons for research. The role NEVER changes facts: derive all numbers from the context the same way for every role.

For "inspect this cell" questions, use the context.selectedCell object if present.

When a question benefits from visualization, choose the appropriate visualization type from: text_only, map, graph, flowchart, map_graph, map_flowchart, map_graph_flowchart. Configure visualization.config with a mode: "hottest", "risk", "routes", "alerts", "temperature", "environment", "priority", "scenario", "comparison", "split", "assets", "location", or "layer".

You can operate THERMA by returning actions. Valid action names are ONLY:
navigate_to, select_location, set_map_layer, zoom_map, reset_map, open_zoe, close_zoe, open_sidebar, close_sidebar, run_heat_analysis, run_environment_analysis, run_route_analysis, create_scenario, compare_locations, open_asset, open_property, open_facility, open_alert, open_report, generate_report, open_decision_workspace, show_visualization.

Each action is an object {"name": "navigate_to", "args": {"screen": "heat"}}. Never invent action names.

Respond ONLY with JSON: {"message": string, "intent": string, "actions": [{"name": string, "args": object}], "visualization": {"type": string, "config": object}}.

Keep the message concise, useful and context-aware.

Role-aware emphasis guide:
- government: prioritize public safety, heat-risk monitoring, infrastructure, vulnerable areas, alerts, intervention planning
- business: prioritize workforce safety, logistics, route exposure, operational continuity, facilities, scheduling
- property: prioritize property heat exposure, asset risk, tenant safety, portfolio exposure, insurance risk, building operations
- emergency: prioritize alerts, critical zones, rapid response, exposed population/assets, emergency operations
- research: prioritize data, trends, scenarios, environmental context, assumptions, methodology
- all_tools: access to every validated THERMA capability, no emphasis restrictions`;

function shapeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return {};
  const allowed = ['location', 'screen', 'activeLayer', 'selectedRole', 'theme', 'selectedArea', 'selectedAsset', 'selectedRoute', 'selectedCell'];
  const out = {};
  for (const k of allowed) out[k] = ctx[k] !== undefined ? ctx[k] : null;

  if (ctx.heat && ctx.heat.stats) {
    out.heat = {
      units: ctx.heat.units,
      stats: ctx.heat.stats,
      topAreas: Array.isArray(ctx.heat.topAreas) ? ctx.heat.topAreas.map((a) => ({ label: a.label, tempF: a.tempF, valueC: a.valueC })).slice(0, 6) : [],
    };
  }
  if (ctx.environment && ctx.environment.current) {
    out.environment = {
      current: {
        heatIndexC: ctx.environment.current.heatIndexC,
        apparentTempC: ctx.environment.current.apparentTempC,
        humidity: ctx.environment.current.humidity,
        aqi: ctx.environment.current.aqi,
        solarIrradiance: ctx.environment.current.solarIrradiance,
        wetBulbC: ctx.environment.current.wetBulbC,
      },
      hourly: ctx.environment.hourly || null,
    };
  }
  if (ctx.exposure) {
    out.exposure = { level: ctx.exposure.level, score: ctx.exposure.score, temperature: ctx.exposure.temperature, drivers: ctx.exposure.drivers };
  }
  if (Array.isArray(ctx.alerts)) {
    out.alerts = ctx.alerts.slice(0, 12).map((a) => ({ type: a.type, severity: a.severity, location: a.location, description: a.description }));
  }
  if (Array.isArray(ctx.assets)) {
    out.assets = ctx.assets.slice(0, 12).map((a) => ({ name: a.name, type: a.type, risk: a.risk ? a.risk.band : null, tempF: a.tempF }));
  }
  if (ctx.routes) {
    out.routes = Array.isArray(ctx.routes) ? ctx.routes : ctx.routes;
  }
  return out;
}

function frameMessage(message, ctx) {
  const role = ctx?.selectedRole || "all_tools";
  const role_cfg = roleConfig(role);
  if (role !== "all_tools" && role_cfg?.emphasis?.length) {
    const frame = `(${role_cfg.emphasis[0]} focus)`;
    if (!message.toLowerCase().includes(frame.toLowerCase())) {
      return `${frame} ${message}`;
    }
  }
  return message;
}

function validateActions(actions) {
  if (!Array.isArray(actions)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of actions) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || '');
    if (!ALLOWED_ACTIONS.has(name)) continue;
    const key = name + JSON.stringify(raw.args || {});
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, args: raw.args && typeof raw.args === 'object' ? raw.args : {} });
  }
  return out.slice(0, 6);
}

function validateVisualization(viz) {
  const okTypes = new Set(['text_only', 'map', 'graph', 'flowchart', 'map_graph', 'map_flowchart', 'map_graph_flowchart']);
  if (!viz || typeof viz !== 'object') return { type: 'text_only', config: {} };
  const type = okTypes.has(viz.type) ? viz.type : 'text_only';
  const config = viz.config && typeof viz.config === 'object' ? viz.config : {};
  return { type, config };
}

async function answer({ message, context, history }) {
  const ctx = shapeContext(context);
  const engineResult = engine.answer(message, ctx);

  if (!gemini.geminiConfigured()) {
    return { ...engineResult, mode: 'engine' };
  }

  try {
    const system = SYSTEM_PROMPT + '\n\ncurrent_application_context: ' + JSON.stringify(ctx);
    const contents = [];
    for (const h of (history || []).slice(-8)) {
      contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
    }
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: message }] });
    }
    const raw = await gemini.generateStructured({ systemInstruction: system, contents });

    const framedMessage = frameMessage(raw.message || engineResult.message, ctx);

    const actions = validateActions(raw.actions);
    const response = {
      message: framedMessage,
      intent: typeof raw.intent === 'string' ? raw.intent : 'answer',
      actions,
      visualization: validateVisualization(raw.visualization),
      mode: 'gemini',
    };
    return response;
  } catch (err) {
    console.error('[ZOE] Gemini failed, falling back to local engine:', err.message);
    return { ...engineResult, mode: 'engine', note: 'fallback' };
  }
}

module.exports = { answer, ALLOWED_ACTIONS, SYSTEM_PROMPT, roleConfig, shapeContext, validateActions, validateVisualization };