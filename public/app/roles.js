// Role-based personalization model — THERMA's single source of truth.
//
// A role NEVER gates access: every screen stays reachable for every role.
// It only re-prioritizes — sidebar category order, Overview KPI order/labels,
// recommendation emphasis and the context Zoe reasons with. All data shown is
// real context data; roles change presentation order and wording only.

import { getState, setState } from './store.js';

export const ROLES = [
  {
    id: 'government',
    name: 'City / Government',
    icon: 'account_balance',
    desc: 'Heat-risk monitoring, infrastructure and public-safety planning.',
    bullets: ['Heat-risk monitoring', 'Infrastructure', 'Public safety', 'Intervention planning'],
  },
  {
    id: 'business',
    name: 'Business / Operations',
    icon: 'business_center',
    desc: 'Workforce, logistics, facilities and operational safety.',
    bullets: ['Workforce', 'Logistics', 'Facilities', 'Operational planning'],
  },
  {
    id: 'property',
    name: 'Property / Asset Manager',
    icon: 'domain',
    desc: 'Portfolio exposure, property intelligence, asset risk and insurance.',
    bullets: ['Portfolio heat exposure', 'Property intelligence', 'Asset risk', 'Insurance'],
  },
  {
    id: 'emergency',
    name: 'Emergency / Safety',
    icon: 'emergency',
    desc: 'Heat alerts, high-risk zones and rapid response.',
    bullets: ['Heat alerts', 'High-risk zones', 'Rapid response', 'Safety operations'],
  },
  {
    id: 'research',
    name: 'Research / Analyst',
    icon: 'science',
    desc: 'Heat intelligence, environmental analysis, maps and scenarios.',
    bullets: ['Heat intelligence', 'Environmental analysis', 'Maps', 'Scenarios'],
  },
  {
    // Platform / demo / judge ACCESS PROFILE — not a business persona and never
    // a navigation item. Selecting it loads the complete platform navigation.
    id: 'all',
    name: 'All Tools',
    icon: 'apps',
    desc: 'Complete THERMA platform access for judges, demos and unrestricted exploration.',
    bullets: ['Every tool', 'Judges & demos', 'Unrestricted navigation'],
    platform: true,
  },
];

// Screen categorization (metadata only — screens are NOT duplicated or hidden).
// Every routed screen appears in exactly one category; 'role' is the onboarding
// selector and intentionally has no sidebar entry.
export const CATEGORIES = [
  { id: 'command', label: 'Command', screens: ['overview', 'workspace'] },
  { id: 'heat', label: 'Heat Intelligence', screens: ['heat', 'environment', 'explorer'] },
  { id: 'operations', label: 'Operations', screens: ['coolroute', 'logistics', 'facilities'] },
  { id: 'assets', label: 'Assets & Property', screens: ['portfolio', 'urban', 'utilities'] },
  { id: 'risk', label: 'Risk & Response', screens: ['risk', 'alerts', 'scenarios'] },
  { id: 'intelligence', label: 'Intelligence & AI', screens: ['zoe', 'search'] },
  { id: 'reporting', label: 'Reporting & System', screens: ['reports', 'location', 'settings', 'therma'] },
];

// Per-role COMPACT primary navigation. Normal roles see only these sections —
// everything else stays reachable under the collapsible "All Tools" group (and
// every screen remains a route; nothing is removed). 'all' shows the complete
// navigation directly.
const PRIMARY_NAV = {
  government: [
    { label: 'Command', screens: ['overview', 'workspace'] },
    { label: 'Heat Intelligence', screens: ['heat', 'environment', 'explorer'] },
    { label: 'Risk & Response', screens: ['alerts', 'risk', 'scenarios'] },
    { label: 'Assets', screens: ['utilities', 'urban'] },
  ],
  business: [
    { label: 'Command', screens: ['overview', 'workspace'] },
    { label: 'Operations', screens: ['coolroute', 'logistics', 'facilities'] },
    { label: 'Assets', screens: ['portfolio', 'utilities'] },
    { label: 'Risk', screens: ['risk', 'alerts'] },
  ],
  property: [
    { label: 'Command', screens: ['overview', 'workspace'] },
    { label: 'Assets & Property', screens: ['portfolio', 'urban', 'facilities', 'utilities'] },
    { label: 'Risk', screens: ['risk'] },
    { label: 'Heat', screens: ['heat', 'environment'] },
  ],
  emergency: [
    { label: 'Command', screens: ['overview', 'workspace'] },
    { label: 'Risk & Response', screens: ['alerts', 'risk', 'scenarios'] },
    { label: 'Heat', screens: ['heat', 'explorer'] },
    { label: 'Operations', screens: ['coolroute'] },
  ],
  research: [
    { label: 'Command', screens: ['overview', 'workspace'] },
    { label: 'Heat Intelligence', screens: ['heat', 'environment', 'explorer'] },
    { label: 'Analysis', screens: ['scenarios', 'search'] },
    { label: 'Intelligence', screens: ['zoe'] },
  ],
};

// Role-flavoured Overview emphasis. Values stay real; labels/ordering adapt.
const KPI_SETS = {
  // base keys: exposure, alerts, hotAssets, range, assets, mean (all computed
  // from the live context — a KPI that can't be computed is skipped, never faked)
  government: [
    { key: 'exposure', label: 'Public Heat Risk' },
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'hotAssets', label: 'Critical Infrastructure' },
    { key: 'range', label: 'Heat Range' },
    { key: 'mean', label: 'Mean Surface' },
  ],
  business: [
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'hotAssets', label: 'Facility Risk' },
    { key: 'assets', label: 'Assets Monitored' },
    { key: 'exposure', label: 'Operational Heat Risk' },
    { key: 'mean', label: 'Mean Surface' },
  ],
  property: [
    { key: 'assets', label: 'Portfolio Assets' },
    { key: 'hotAssets', label: 'Highest-Risk Assets' },
    { key: 'exposure', label: 'Portfolio Exposure' },
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'range', label: 'Heat Range' },
  ],
  emergency: [
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'hotAssets', label: 'Highest-Risk Zones' },
    { key: 'range', label: 'Peak Heat' },
    { key: 'exposure', label: 'Response Priority' },
    { key: 'mean', label: 'Mean Surface' },
  ],
  research: [
    { key: 'mean', label: 'Mean Surface' },
    { key: 'range', label: 'Thermal Range' },
    { key: 'exposure', label: 'Exposure Score' },
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'assets', label: 'Assets Monitored' },
  ],
  // Platform/demo mode: neutral order, no persona labelling.
  all: [
    { key: 'mean', label: 'Mean Surface' },
    { key: 'range', label: 'Thermal Range' },
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'assets', label: 'Assets Monitored' },
    { key: 'exposure', label: 'Heat Exposure' },
  ],
};

const EMPHASIS = {
  government: { title: 'Public-safety view', line: 'Prioritizing heat risk, alerts and infrastructure exposure across the selected area.' },
  business: { title: 'Operations view', line: 'Prioritizing routes, logistics, facilities and workforce exposure.' },
  property: { title: 'Portfolio view', line: 'Prioritizing asset risk, property exposure and insurance posture.' },
  emergency: { title: 'Response view', line: 'Prioritizing active alerts, hottest zones and rapid-response priorities.' },
  research: { title: 'Analysis view', line: 'Prioritizing thermal statistics, environmental trends and spatial analysis.' },
  // 'all' is the platform/demo mode — no persona emphasis.
  all: null,
};

// Recommendation-type affinity: reorders the context recommendations, never
// replaces them (every recommendation shown is still real context output).
const REC_AFFINITY = {
  government: ['intervention', 'planning', 'operations', 'maintenance'],
  business: ['operations', 'maintenance', 'intervention', 'planning'],
  property: ['maintenance', 'intervention', 'planning', 'operations'],
  emergency: ['intervention', 'operations', 'maintenance', 'planning'],
  research: ['planning', 'intervention', 'operations', 'maintenance'],
};

// Zoe operator profiles — ONE engine, role-aware presentation. A profile only
// changes terminology, suggested prompts and suggested follow-up actions; it
// never changes facts, data access or action availability. Every action
// referenced here is part of Zoe's backend-validated allowlist.
export const ZOE_PROFILES = {
  government: {
    focus: 'public safety, heat-risk monitoring and intervention planning',
    chips: ['Critical zones', 'Active alerts', 'Infrastructure', 'Safety report'],
    suggestions: [
      'Which neighborhoods are at highest risk?',
      'Show critical zones.',
      'Show active alerts.',
      'Generate a public safety report.',
    ],
    actions: [
      { label: 'Review high-risk zones', name: 'run_heat_analysis', args: { layer: 'temperature' } },
      { label: 'Open Alerts', name: 'navigate_to', args: { screen: 'alerts' } },
      { label: 'Public safety report', name: 'generate_report', args: {} },
    ],
  },
  business: {
    focus: 'workforce safety, logistics and operational continuity',
    chips: ['Coolest route', 'Best time to go outside', 'Facilities', 'Generate report'],
    suggestions: [
      'Find the coolest route.',
      'When should outdoor work happen?',
      'Open Facilities.',
      'Analyze this corridor.',
    ],
    actions: [
      { label: 'Plan CoolRoute', name: 'navigate_to', args: { screen: 'coolroute' } },
      { label: 'Safer operating window', name: 'run_environment_analysis', args: {} },
      { label: 'Open Facilities', name: 'navigate_to', args: { screen: 'facilities' } },
    ],
  },
  property: {
    focus: 'portfolio exposure, asset risk and building operations',
    suggestions: [
      'Which assets are most exposed?',
      'Open Portfolio.',
      'Show property risk.',
    ],
    actions: [
      { label: 'Open Portfolio', name: 'navigate_to', args: { screen: 'portfolio' } },
      { label: 'Generate asset report', name: 'generate_report', args: {} },
      { label: 'Open Urban & Property', name: 'navigate_to', args: { screen: 'urban' } },
    ],
  },
  emergency: {
    focus: 'active alerts, critical zones and rapid response',
    suggestions: [
      'Show critical alerts.',
      'Where is the highest risk?',
      'Find the safest route.',
    ],
    actions: [
      { label: 'Open Alerts', name: 'navigate_to', args: { screen: 'alerts' } },
      { label: 'Run heat analysis', name: 'run_heat_analysis', args: { layer: 'temperature' } },
      { label: 'Decision Workspace', name: 'open_decision_workspace', args: { mode: 'split' } },
    ],
  },
  research: {
    focus: 'thermal data, scenarios, assumptions and methodology',
    suggestions: [
      'Explain this thermal layer.',
      'Show persistence.',
      'Explain the assumptions.',
      'Open Environment.',
    ],
    actions: [
      { label: 'Open Heat Intelligence', name: 'navigate_to', args: { screen: 'heat' } },
      { label: 'Show persistence', name: 'set_map_layer', args: { layer: 'persistence' } },
      { label: 'Open Scenarios', name: 'navigate_to', args: { screen: 'scenarios' } },
    ],
  },
  // All Tools is the unrestricted access profile: the full operational surface.
  all: {
    focus: 'the complete THERMA platform',
    suggestions: [
      'Open Heat Intelligence.',
      'Run heat analysis.',
      'Open CoolRoute.',
      'Generate report.',
    ],
    actions: [
      { label: 'Open Heat Intelligence', name: 'navigate_to', args: { screen: 'heat' } },
      { label: 'Run heat analysis', name: 'run_heat_analysis', args: { layer: 'temperature' } },
      { label: 'Open CoolRoute', name: 'navigate_to', args: { screen: 'coolroute' } },
      { label: 'Generate report', name: 'generate_report', args: {} },
      { label: 'Show alerts', name: 'navigate_to', args: { screen: 'alerts' } },
      { label: 'Show environment', name: 'navigate_to', args: { screen: 'environment' } },
    ],
  },
};

export function zoeProfileFor(roleId) {
  return ZOE_PROFILES[roleId] || ZOE_PROFILES.all;
}

// ---------------- persistence ----------------

const STORAGE_KEY = 'therma.role';

export function getSelectedRole() {
  return getState().selectedRole || null;
}

export function roleById(id) {
  return ROLES.find((r) => r.id === id) || null;
}

export function setSelectedRole(id) {
  const role = roleById(id);
  if (!role) return false;
  setState({ selectedRole: role.id });
  try { localStorage.setItem(STORAGE_KEY, role.id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('therma:role', { detail: { id: role.id } }));
  return true;
}

export function loadPersistedRole() {
  try {
    // Legacy key from the removed sidebar "All Tools" toggle — nothing reads
    // it anymore; clear it so no stale expansion state lingers.
    localStorage.removeItem('therma.allTools');
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && roleById(id)) setState({ selectedRole: id });
  } catch { /* ignore */ }
}

// ---------------- derived navigation ----------------

// Compact primary sections for a normal role (null for 'all'/unknown).
export function primaryNavFor(roleId) {
  return PRIMARY_NAV[roleId] || null;
}

// The complete platform navigation — the canonical category model, in a stable
// order. Used for the "All Tools" group and for the 'all' platform mode.
export function completeNav() {
  return CATEGORIES.map((c) => ({ id: c.id, label: c.label, screens: [...c.screens] }));
}

export function kpiSetFor(roleId) {
  return KPI_SETS[roleId] || KPI_SETS.research;
}

export function emphasisFor(roleId) {
  return EMPHASIS[roleId] || null;
}

export function orderRecommendations(roleId, recs) {
  if (!Array.isArray(recs) || !recs.length) return recs;
  const aff = REC_AFFINITY[roleId] || REC_AFFINITY.research;
  return [...recs].sort((a, b) => {
    const ia = aff.indexOf(a && a.type);
    const ib = aff.indexOf(b && b.type);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// One grounded, role-specific recommendation appended to the Overview list.
// Numbers come from the passed context only; null when nothing real to say.
export function roleRecommendation(roleId, ctx) {
  if (!ctx) return null;
  const exp = ctx.exposure || {};
  const alerts = (ctx.alerts || []).filter((a) => a.severity === 'Critical');
  const hot = (ctx.assets || []).filter((a) => a.risk && a.risk.index >= 4).sort((a, b) => b.risk.index - a.risk.index)[0];
  const meanF = ctx.heatmap && ctx.heatmap.stats ? Math.round(ctx.heatmap.stats.mean * 9 / 5 + 32) : null;
  switch (roleId) {
    case 'government':
      return alerts.length
        ? { priority: 'High', title: 'Public-safety priority', detail: `${alerts.length} critical alert${alerts.length === 1 ? '' : 's'} active in ${ctx.location.display} — prioritize inspection of the highest-risk infrastructure zone.`, type: 'intervention' }
        : { priority: 'Standard', title: 'Public-safety priority', detail: `No critical alerts in ${ctx.location.display}. Surface mean near ${meanF != null ? meanF + '°F' : '—'} — keep monitoring high-exposure zones.`, type: 'planning' };
    case 'business':
      return { priority: exp.score >= 60 ? 'High' : 'Medium', title: 'Operational window', detail: `Shift outdoor operations to the lower-exposure window (see Best Time Outside) — current exposure score ${exp.score != null ? exp.score + '/100' : 'unavailable'}.`, type: 'operations' };
    case 'property':
      return hot
        ? { priority: 'High', title: 'Mitigation priority', detail: `${hot.name} is the highest-exposure asset in the portfolio (${hot.tempF != null ? Math.round(hot.tempF) + '°F' : 'temperature n/a'}). Review mitigation options before the next peak window.`, type: 'maintenance' }
        : { priority: 'Standard', title: 'Mitigation priority', detail: 'No assets in high/critical bands right now — maintain standard mitigation posture.', type: 'maintenance' };
    case 'emergency':
      return alerts.length
        ? { priority: 'High', title: 'Response priority', detail: `Address the critical alert at ${alerts[0].location} first — it carries the highest exposure in the current context.`, type: 'intervention' }
        : { priority: 'Standard', title: 'Response priority', detail: 'No critical alerts active. Keep response crews staged for the midday peak window.', type: 'operations' };
    case 'research':
      return { priority: 'Standard', title: 'Analysis lead', detail: `Compare persistence and exceedance layers for ${ctx.location.display} against a second location in the Decision Workspace to isolate heat-island drivers.`, type: 'planning' };
    default:
      return null;
  }
}
