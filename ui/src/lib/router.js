// Hash-based router (ported from public/app/router.js)

const ROUTES = {
  splash: { path: "/", title: "Initializing", screen: "SplashScreen" },
  overview: { path: "/overview", title: "Command Overview", screen: "OverviewScreen" },
  heat: { path: "/heat", title: "Heat Intelligence", screen: "HeatIntelligenceScreen" },
  coolroute: { path: "/coolroute", title: "CoolRoute", screen: "CoolRouteScreen" },
  explorer: { path: "/explorer", title: "Map Explorer", screen: "MapExplorerScreen" },
  environment: { path: "/environment", title: "Environmental Intelligence", screen: "EnvironmentalScreen" },
  portfolio: { path: "/portfolio", title: "Portfolio Monitoring", screen: "PortfolioScreen" },
  urban: { path: "/urban", title: "Urban & Property Intelligence", screen: "UrbanPropertyScreen" },
  facilities: { path: "/facilities", title: "Facility Analysis", screen: "FacilityScreen" },
  logistics: { path: "/logistics", title: "Logistics Operations", screen: "LogisticsScreen" },
  utilities: { path: "/utilities", title: "Infrastructure & Utilities", screen: "InfrastructureScreen" },
  risk: { path: "/risk", title: "Risk & Insurance", screen: "RiskInsuranceScreen" },
  scenarios: { path: "/scenarios", title: "Scenario Simulation", screen: "ScenarioScreen" },
  alerts: { path: "/alerts", title: "Active Alerts", screen: "AlertsScreen" },
  reports: { path: "/reports", title: "Reports Library", screen: "ReportsScreen" },
  workspace: { path: "/workspace", title: "Decision Workspace", screen: "DecisionWorkspaceScreen" },
  zoe: { path: "/zoe", title: "Zoe Operator Workspace", screen: "ZoeWorkspaceScreen" },
  search: { path: "/search", title: "Global Search", screen: "SearchScreen" },
  location: { path: "/location/:param", title: "Location Detail", screen: "LocationDetailScreen" },
  settings: { path: "/settings", title: "Platform Settings", screen: "SettingsScreen" },
  intelligence: { path: "/intelligence", title: "THERMA Intelligence", screen: "ThermaIntelligenceScreen" }
};

let currentRoute = null;
let routeChangeCallback = null;

function parseHash() {
  const hash = window.location.hash.slice(1) || "/";
  const [path, queryString] = hash.split("?");
  const query = {};
  if (queryString) {
    queryString.split("&").forEach(p => {
      const [k, v] = p.split("=");
      query[decodeURIComponent(k)] = v ? decodeURIComponent(v) : true;
    });
  }
  return { path, query };
}

function matchRoute(path) {
  for (const [name, route] of Object.entries(ROUTES)) {
    const pattern = route.path.replace(/:(\w+)/g, "([^/]+)");
    const regex = new RegExp(`^${pattern}$`);
    const match = path.match(regex);
    if (match) {
      const params = {};
      const paramNames = route.path.match(/:(\w+)/g) || [];
      paramNames.forEach((p, i) => {
        params[p.slice(1)] = match[i + 1];
      });
      return { name, route, params, query: {} };
    }
  }
  return null;
}

function navigate(name, { params = {}, query = {}, replace = false } = {}) {
  let path = ROUTES[name]?.path || "/";
  for (const [k, v] of Object.entries(params)) {
    path = path.replace(`:${k}`, encodeURIComponent(v));
  }
  const queryString = Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const hash = queryString ? `#${path}?${queryString}` : `#${path}`;
  if (replace) {
    window.history.replaceState(null, "", hash);
  } else {
    window.location.hash = hash;
  }
}

function current() {
  return currentRoute;
}

export function initRouter(onChange) {
  routeChangeCallback = onChange;
  
  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

function handleHashChange() {
  const { path, query } = parseHash();
  const matched = matchRoute(path);
  
  if (!matched) {
    window.location.hash = "#/overview";
    return;
  }
  
  matched.query = query;
  currentRoute = matched;
  
  document.title = `${ROUTES[matched.name].title} \u00b7 THERMA`;
  
  if (routeChangeCallback) {
    routeChangeCallback(matched);
  }
}

export function resolve(route, host) {
  // Dynamic import screen component
  const screenName = ROUTES[route.name].screen;
  import(`../screens/${screenName}.js`).then(module => {
    if (module.mount) {
      host.innerHTML = "";
      module.mount(host, route);
    }
  }).catch(err => {
    console.error(`Failed to load screen ${screenName}:`, err);
    host.innerHTML = `<div class="p-8 text-center text-error">Failed to load screen: ${screenName}</div>`;
  });
}

export { ROUTES, navigate, current };
