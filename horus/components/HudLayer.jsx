'use client';
import { useEffect, useState } from 'react';
import { Search, PanelsTopLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useHorus, CAT, FEED_SOURCES, SEVERITIES, findPlace } from './store';
const LEG = { unrest: 'CIVIL UNREST/PROTESTS (MAROON)', conflict: 'STATE CONFLICTS (RED)', election: 'ELECTIONS/POLITICAL SHIFTS (YELLOW)', anomaly: 'NETWORK/DATA ANOMALIES (BLUE)' };

export function Legend() { // doubles as the category filter
  const { filters, sourceFilters, severityFilters, toggle, toggleSource, toggleSeverity } = useHorus();
  return (
    <div className="hud-card w-64 p-3">
      {Object.keys(LEG).map((k) => (
        <button key={k} onClick={() => toggle(k)} aria-pressed={filters[k]} className="ui flex w-full items-center gap-2 p-1 caption-5 hover:bg-cyan-500/10"
          style={{ color: filters[k] ? '#38BDF8' : '#475569' }}>
          <span className="size-2 rounded-full" style={{ background: CAT[k].color, opacity: filters[k] ? 1 : 0.3 }} />{LEG[k]}</button>))}
      <div className="mt-2 border-t border-cyan-500/20 pt-2 caption-5">
        <div className="mb-1 text-cyan-300">FEEDS</div>
        {FEED_SOURCES.map((source) => <button key={source} onClick={() => toggleSource(source)} aria-pressed={sourceFilters[source]} className="ui mr-1 mb-1 rounded border border-cyan-500/20 px-1" style={{ opacity: sourceFilters[source] ? 1 : 0.35 }}>{source.replace('_', ' ')}</button>)}
        <div className="mb-1 mt-1 text-cyan-300">SEVERITY</div>
        {SEVERITIES.slice(0, 4).map((severity) => <button key={severity} onClick={() => toggleSeverity(severity)} aria-pressed={severityFilters[severity]} className="ui mr-1 rounded border border-cyan-500/20 px-1" style={{ opacity: severityFilters[severity] ? 1 : 0.35 }}>{severity}</button>)}
      </div>
    </div>
  );
}

export function SearchPill() {
  const { events, setFocus, select } = useHorus(), [q, setQ] = useState(''), [err, setErr] = useState('');
  const go = (ev) => {
    ev.preventDefault(); setErr('');
    const s = q.trim().toLowerCase(), hit = events.find((e) => s && (e.title.toLowerCase().includes(s) || e.tags.some((t) => t.toLowerCase().includes(s))));
    const [la, lo] = q.split(',').map(Number);
    if (hit) { select(hit.id); setFocus({ lat: hit.lat, lon: hit.lon }); }
    else if (findPlace(q)) { const place = findPlace(q); select(null); setFocus({ lat: place.coordinates[0], lon: place.coordinates[1] }); }
    else if (Math.abs(la) <= 90 && Math.abs(lo) <= 180) setFocus({ lat: la, lon: lo });
    else setErr('No match. Try a place, a tag, or lat, long.');
  };
  return (
    <form onSubmit={go} className="w-full max-w-md">
      <label className="hud-card flex items-center gap-2 p-2">
        <span className="caption-5 whitespace-nowrap text-cyan-300">SEARCH TARGET/LOCATION:</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Iran..." aria-label="Search target or location" className="body-6 min-w-0 flex-1 bg-transparent text-cyan-100 outline-none" />
        <button aria-label="Search" className="ui p-1"><Search size={16} /></button>
      </label>
      {err && <p role="alert" className="mt-1 caption-5 text-red-400">{err}</p>}
    </form>
  );
}

export function Ticker() {
  const events = useHorus((s) => s.events);
  return (
    <div className="hud-card max-w-xs p-3 caption-5 text-cyan-100">
      <span className="text-cyan-300">BREAKING:</span> {events.filter((e) => e.cat !== 'anomaly').slice(0, 3).map((e) => e.title).join(' :: ')}
    </div>
  );
}

export function StatusLine({ onToggle }) {
  const [now, setNow] = useState(null);
  const { networkLatency, defcon } = useHorus();
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); setNow(new Date()); return () => clearInterval(i); }, []);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-cyan-500/20 bg-slate-950/50 p-3 caption-3 backdrop-blur-md">
      <span>GLOBAL THREAT STATUS ::</span><span className="text-amber-400">DEFCON: {defcon} (ELEVATED)</span>
      <span>:: ACTIVE MONITORING :: SYSTEM TIME: UTC <span className="tabular-nums text-cyan-200">{now ? now.toISOString().slice(11, 19) : '--:--:--'}</span> :: NETWORK LATENCY: <span className="text-green-400">{networkLatency}</span> :: STABLE</span>
      <button onClick={onToggle} className="ui ml-2 flex items-center gap-1 border border-cyan-500/30 p-1 hover:bg-cyan-500/10"><PanelsTopLeft size={14} />OPS PANELS</button>
    </div>
  );
}

export function ModeSwitch() {
  const { mode, setMode } = useHorus();
  const B = (m, l) => (
    <button onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`ui border p-1 caption-3 hover:bg-cyan-500/10 ${mode === m ? 'border-cyan-400 text-cyan-200' : 'border-transparent'}`}>{l}{mode === m ? ' (ACTIVE)' : ''}</button>);
  return <div className="hud-card flex items-center gap-2 p-1 caption-3"><span className="pl-1">MODE:</span>{B('3d', '3D GLOBE')}{B('2d', '2D FLAT GRID')}</div>;
}

const ROWS = [['pings', 'EVENT PINGS', 'Protests, conflicts, elections, anomalies'], ['air', 'AIR TRAFFIC (ADS-B)', 'Moving vector plane icons'],
  ['ships', 'MARITIME (AIS)', 'Vessel points along shipping lanes'], ['sats', 'SATELLITES (NORAD TLE)', 'High altitude orbital tracks']];
export function LayerMatrix() {
  const { layers, toggleLayer } = useHorus(), [open, setOpen] = useState(true);
  return (
    <div className="hud-card pointer-events-auto fixed left-4 top-1/2 z-20 w-64 -translate-y-1/2 p-2">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="ui flex w-full items-center justify-between p-1 caption-3">LAYER MATRIX{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      {open && <div className="mt-2 flex flex-col gap-1">
        {ROWS.map(([k, l, d]) => (
          <button key={k} onClick={() => toggleLayer(k)} aria-pressed={layers[k]} className="ui glass-inner p-2 text-left hover:bg-cyan-500/10" style={{ color: layers[k] ? '#7DD3FC' : '#64748B' }}>
            <div className="caption-3">[{layers[k] ? 'x' : ' '}] {l}</div><div className="caption-5">{d}</div></button>))}
        <p className="p-1 caption-5 text-cyan-400/60">Air, maritime and satellite tracks are simulated. Connect live feeds to replace them.</p></div>}
    </div>
  );
}
