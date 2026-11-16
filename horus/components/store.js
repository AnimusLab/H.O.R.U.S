import { create } from 'zustand';
export const CAT = {
  conflict: { color: '#FF0033', label: 'Conflicts' },
  unrest: { color: '#9333EA', label: 'Civil Unrest' },
  election: { color: '#EAB308', label: 'Elections' },
  anomaly: { color: '#06B6D4', label: 'Financial' },
};
// SIMULATED seed data. Replace with your ingest pipeline. 7th item = optional 2D callout (at: screen fractions, side: l or r).
const seed = [
  ['e1','conflict',35.69,51.39,'Escalation reported near Tehran',['IRAN','AIRSPACE'],{at:[0.74,0.4],side:'l',lines:['IRAN/US CONFLICT :: HIGH TENSIONS ::','RED_TRAJECTORY :: ACTIVE :: DEFCON 3']}],
  ['e2','conflict',38.9,-77.04,'Emergency session convened in Washington',['US','NSC']],
  ['e3','unrest',48.85,2.35,'Paris protests intensify',['FRANCE','LABOR'],{at:[0.3,0.24],side:'r',lines:['PARIS PROTESTS :: CIVIL UNREST ::','MAROON_TAG :: ACTIVE :: UTC 16:15']}],
  ['e4','unrest',-23.55,-46.63,'Road blockades reported in São Paulo',['BRAZIL','TRANSPORT']],
  ['e5','election',28.61,77.21,'Counting underway in state assembly poll',['INDIA','ECI']],
  ['e6','election',-1.29,36.82,'Polling stations open in Nairobi',['KENYA','IEBC']],
  ['e9','election',-15.8,-47.9,'Brazil elections draw heavy turnout',['BRAZIL','TSE'],{at:[0.22,0.78],side:'r',lines:['BRAZIL ELECTIONS','(YELLOW_PULSE)']}],
  ['e10','election',-34.6,-58.4,'Argentina local elections open',['ARGENTINA']],
  ['e7','anomaly',1.35,103.82,'Routing anomaly seen on regional exchange link',['BGP','SINGAPORE']],
  ['e8','anomaly',51.5,-0.12,'Latency spike across a London data hub',['LINX','UK']],
  ['e11','anomaly',0,-25,'Subsea cable flap mid Atlantic',['CABLE']],
  ['e12','anomaly',-20,70,'Indian Ocean node flicker',['CABLE']],
  ['e13','anomaly',30,-40,'North Atlantic relay jitter',['RELAY']],
  ['e14','anomaly',10,-140,'Pacific data node anomaly',['CABLE']],
].map(([id,cat,lat,lon,title,tags,callout],i)=>({id,cat,lat,lon,title,tags,callout,ts:Date.now()-i*420000}));
export const PLACE = { e1:'TEHRAN', e2:'WASHINGTON DC', e3:'PARIS', e4:'SAO PAULO', e5:'NEW DELHI', e6:'NAIROBI', e7:'SINGAPORE', e8:'LONDON', e9:'BRASILIA', e10:'BUENOS AIRES' };
export const PLACE_INDEX = {
  china: [35.86, 104.19],
  beijing: [39.90, 116.40],
  shanghai: [31.23, 121.47],
  iran: [32.43, 53.69],
  tehran: [35.69, 51.39],
  france: [46.23, 2.21],
  paris: [48.86, 2.35],
  'united states': [39.83, -98.58],
  usa: [39.83, -98.58],
  washington: [38.90, -77.04],
  brazil: [-10.81, -51.93],
  'sao paulo': [-23.55, -46.63],
  india: [20.59, 78.96],
  'new delhi': [28.61, 77.21],
  kenya: [0.02, 37.91],
  nairobi: [-1.29, 36.82],
};
export const findPlace = (query) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  const key = Object.keys(PLACE_INDEX).find((name) => name === normalized || name.includes(normalized));
  return key ? { name: key, coordinates: PLACE_INDEX[key] } : null;
};
export const FEED_SOURCES = ['USGS_EARTHQUAKES', 'NOAA_ALERTS'];
export const SEVERITIES = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'SEVERE', 'EXTREME', 'UNKNOWN'];
export const MAP_SOURCES = {
  tactical: { label: 'HORUS TACTICAL', detail: 'Local procedural globe' },
  photorealistic: { label: 'PHOTOREALISTIC 3D', detail: 'Google Maps provider required' },
  open: { label: 'OPEN TERRAIN', detail: 'Open geospatial sources' },
};
export const validTelemetry = (data) => data && data.schema_version === 1 && typeof data.timestamp === 'string' &&
  typeof data.network_latency_ms === 'number' && typeof data.defcon === 'number' &&
typeof data.distance_km === 'number' && typeof data.feed_status === 'string' &&
typeof data.source === 'string' && typeof data.active_events_count === 'number' &&
(data.feed_last_success === null || typeof data.feed_last_success === 'string') &&
Array.isArray(data.events) && data.events.every((event) =>
  typeof event.id === 'string' && event.category === 'anomaly' &&
typeof event.source === 'string' && typeof event.severity === 'string' && typeof event.timestamp === 'string' &&
  typeof event.latitude === 'number' && typeof event.longitude === 'number' &&
  typeof event.title === 'string' && Array.isArray(event.tags)
);
export const useHorus = create((set) => ({
  events: seed,
  arcs: [{ a: [35.69, 51.39], b: [38.9, -77.04] }, { a: [35.69, 51.39], b: [48.85, 2.35] }, { a: [48.85, 2.35], b: [38.9, -77.04] }],
  filters: { conflict: true, unrest: true, election: true, anomaly: true },
  sourceFilters: { USGS_EARTHQUAKES: true, NOAA_ALERTS: true, GDELT_DEMO: true, ADS_B_DEMO: true },
  severityFilters: Object.fromEntries(SEVERITIES.map((severity) => [severity, true])),
  layers: { pings: true, air: false, ships: false, sats: false },
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  mapSource: 'tactical',
  setMapSource: (mapSource) => set({ mapSource }),
  mode: '2d', setMode: (mode) => set({ mode }), selectArc: (i) => set({ selected: 'arc:' + i }),
  ops: false, setOps: (ops) => set({ ops }),
  focus: null, selected: null, logs: [],
  systemStatus: 'LOCAL_DEMO', systemTime: null, networkLatency: '--', defcon: 3,
  activeEventsCount: 0, activeNode: 'LOCAL_DEMO', distanceKm: null, feedSource: 'LOCAL_DEMO', feedStatus: 'LOCAL_DEMO',
  feedLastSuccess: null, feedStatusBySource: {
    USGS_EARTHQUAKES: { status: 'UNKNOWN', lastSuccess: null, eventCount: 0 },
    NOAA_ALERTS: { status: 'UNKNOWN', lastSuccess: null, eventCount: 0 },
  }, activity: null, telemetryConnected: false,
  toggle: (k) => set((s) => ({ filters: { ...s.filters, [k]: !s.filters[k] } })),
  toggleSource: (source) => set((s) => ({ sourceFilters: { ...s.sourceFilters, [source]: !s.sourceFilters[source] } })),
  toggleSeverity: (severity) => set((s) => ({ severityFilters: { ...s.severityFilters, [severity]: !s.severityFilters[severity] } })),
  setFocus: (focus) => set({ focus }),
  select: (selected) => set({ selected }),
  pushLog: (l) => set((s) => ({ logs: [...s.logs.slice(-60), l] })),
  pushEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 30) })),
}));

export function applyTelemetryPayload(event) {
  if (!validTelemetry(event)) return false;
  const state = useHorus.getState();
  const existing = new Set(state.events.map((item) => item.id));
  const newEvents = event.events
    .filter((item) => !existing.has(item.id))
    .map((item) => ({
      id: item.id, cat: item.category, lat: item.latitude, lon: item.longitude,
      title: item.title, tags: item.tags, source: item.source, severity: item.severity, ts: Date.parse(item.timestamp),
    }));
  useHorus.setState({
    systemStatus: event.system_status,
    systemTime: event.timestamp,
    networkLatency: `${event.network_latency_ms}ms`,
    defcon: event.defcon,
    activeEventsCount: event.active_events_count,
    activeNode: event.active_node,
    distanceKm: event.distance_km,
    feedStatus: event.feed_status,
    feedSource: event.source,
    feedLastSuccess: event.feed_last_success,
    feedStatusBySource: {
      ...state.feedStatusBySource,
      [event.source]: {
        status: event.feed_status,
        lastSuccess: event.feed_last_success,
        eventCount: event.active_events_count,
      },
    },
  });
  newEvents.forEach((item) => useHorus.getState().pushEvent(item));
  useHorus.getState().pushLog({
    t: new Date(event.timestamp).toISOString().slice(11, 19),
    lvl: 'INFO',
    msg: `${event.latest_intel || 'Telemetry update'} :: ${event.active_node} :: ${event.network_latency_ms}ms`,
  });
  return true;
}

export function initTelemetrySocket() {
  if (typeof window === 'undefined' || !('WebSocket' in window)) return () => {};
  const configuredUrl = process.env.NEXT_PUBLIC_TELEMETRY_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const telemetryUrl = configuredUrl ||
    `${protocol}//${window.location.hostname}:4000/ws/telemetry`;
  let socket;
  let retryTimer;
  let stopped = false;
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(telemetryUrl);
    socket.onopen = () => useHorus.setState({ telemetryConnected: true });
    socket.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(data);
        if (!applyTelemetryPayload(event)) throw new Error('invalid telemetry shape');
      } catch {
        useHorus.getState().pushLog({
          t: new Date().toISOString().slice(11, 19),
          lvl: 'WARN',
          msg: 'Telemetry payload ignored',
        });
      }

    };
    socket.onerror = () => useHorus.setState({ telemetryConnected: false });
    socket.onclose = () => {
      useHorus.setState({ telemetryConnected: false });
      if (!stopped) retryTimer = window.setTimeout(connect, 3000);
    };
  };
  connect();
  return () => {
    stopped = true;
    window.clearTimeout(retryTimer);
    socket?.close();
  };
}

export function initActivityMonitor() {
  if (typeof window === 'undefined') return () => {};
  const configuredUrl = process.env.NEXT_PUBLIC_TELEMETRY_WS_URL;
  const activityUrl = configuredUrl
    ? configuredUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/telemetry$/, '/activity')
    : `${window.location.protocol}//${window.location.hostname}:4000/activity`;
  let stopped = false;
  let timer;
  const poll = async () => {
    try {
      const response = await fetch(activityUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`activity request failed: ${response.status}`);
      useHorus.setState({ activity: await response.json() });
    } catch {
      useHorus.setState({ activity: null });
    } finally {
      if (!stopped) timer = window.setTimeout(poll, 5000);
    }
  };
  poll();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
