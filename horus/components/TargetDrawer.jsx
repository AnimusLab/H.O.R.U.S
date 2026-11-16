'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Crosshair, Route, Download } from 'lucide-react';
import { useHorus, CAT, PLACE } from './store';
const DEF = { conflict: 3, unrest: 4, election: 5, anomaly: 4 }, SEV = { conflict: 82, unrest: 58, election: 24, anomaly: 41 };
const LIVE_SEV = { LOW: 25, MODERATE: 50, HIGH: 75, SEVERE: 85, CRITICAL: 100, EXTREME: 100, UNKNOWN: 35 };
const NAME = { conflict: 'State conflict', unrest: 'Civil unrest', election: 'Election or political event', anomaly: 'Network or data anomaly' };
const rad = Math.PI / 180, ang = (a, b) => Math.acos(Math.min(1, Math.sin(a[0] * rad) * Math.sin(b[0] * rad) + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad)));
const f = (n, p, q) => `${Math.abs(n).toFixed(4)}° ${n >= 0 ? p : q}`;

export default function TargetDrawer() {
  const { selected, events, arcs, select, setFocus } = useHorus(), [msg, setMsg] = useState(''), last = useRef(null);
  const arc = selected?.startsWith('arc:') ? arcs[+selected.slice(4)] : null, e = !arc ? events.find((x) => x.id === selected) : null;
  useEffect(() => {
    setMsg(''); const k = (ev) => ev.key === 'Escape' && select(null);
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [selected]);
  let t = null;
  if (e) t = { title: PLACE[e.id] || `NODE ${e.id.toUpperCase()}`, cat: e.cat, raw: e, focus: { lat: e.lat, lon: e.lon }, sev: LIVE_SEV[e.severity] || SEV[e.cat] + ([...e.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 9),
    rows: [['SOURCE', e.source || 'LOCAL_DEMO'], ['SEVERITY', e.severity || 'SIMULATED'], ['LAT', f(e.lat, 'N', 'S')], ['LONG', f(e.lon, 'E', 'W')], ['ALTITUDE', 'SURFACE (0 m)'], ['UTC', new Date(e.ts).toISOString().slice(0, 19) + 'Z']],
    head: e.title, tags: e.tags, rel: events.filter((x) => x.cat === e.cat && x.id !== e.id).slice(0, 3) };
  if (arc) { const a = ang(arc.a, arc.b), h = 0.35 * Math.sqrt(a / Math.PI);
    t = { title: 'CONFLICT TRAJECTORY', cat: 'conflict', raw: arc, focus: { lat: (arc.a[0] + arc.b[0]) / 2, lon: (arc.a[1] + arc.b[1]) / 2 }, sev: 88,
      rows: [['FROM', `${arc.a[0].toFixed(2)}, ${arc.a[1].toFixed(2)}`], ['TO', `${arc.b[0].toFixed(2)}, ${arc.b[1].toFixed(2)}`], ['DISTANCE', `${Math.round(a * 6371)} km`], ['APOGEE', `${Math.round(h * 6371)} km`], ['UTC', new Date().toISOString().slice(0, 19) + 'Z']],
      head: 'Tension between linked conflict nodes', tags: ['ARC'], rel: events.filter((x) => x.cat === 'conflict').slice(0, 3) }; }
  if (t) last.current = t;
  const v = t || last.current, open = !!t, col = v ? CAT[v.cat].color : '#38BDF8';
  const exp = () => { const u = URL.createObjectURL(new Blob([JSON.stringify({ simulated: true, target: v.raw }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = u; a.download = `horus-${v.title.toLowerCase().replace(/\W+/g, '-')}.json`; a.click(); URL.revokeObjectURL(u); };
  const Btn = ({ i: I, l, on }) => <button onClick={on} className="ui glass-inner flex items-center justify-center gap-2 p-2 caption-3 hover:bg-cyan-500/10"><I size={14} />[ {l} ]</button>;
  return (
    <aside aria-hidden={!open} aria-label="Target inspection" className={`hud-card pointer-events-auto fixed bottom-14 right-3 top-28 z-30 flex w-80 flex-col gap-2 overflow-y-auto p-2 transition-[transform,visibility] duration-300 ease-weighted ${open ? 'translate-x-0' : 'invisible translate-x-[110%]'}`}>
      {v && <>
        <div className="flex items-center justify-between gap-2 p-1"><h2 className="caption-3">TARGET ANCHOR :: {v.title}</h2>
          <button onClick={() => select(null)} aria-label="Close drawer" className="ui p-1 hover:bg-cyan-500/10"><X size={16} /></button></div>
        <section className="glass-inner p-2"><h3 className="caption-3">Coordinates</h3>
          {v.rows.map(([k, x]) => <div key={k} className="flex justify-between gap-2 caption-5"><span>{k}</span><span className="text-cyan-100">{x}</span></div>)}</section>
        <section className="glass-inner p-2"><h3 className="caption-3">Threat classification</h3>
          <div className="caption-5" style={{ color: col }}>{arc ? 'State conflict trajectory' : NAME[v.cat]}</div>
          {!arc && v.raw.source && <div className="caption-5">SOURCE: {v.raw.source}</div>}
          <div className="caption-5">DEFCON RATING: {DEF[v.cat]} (simulated)</div>
          <div className="mt-1 h-2 bg-slate-800" role="progressbar" aria-valuenow={v.sev} aria-valuemin={0} aria-valuemax={100} aria-label="Severity score"><div className="h-full" style={{ width: `${v.sev}%`, background: col }} /></div>
          <div className="caption-5">SEVERITY {v.sev}/100</div></section>
        <section className="glass-inner p-2"><h3 className="caption-3">Entity cross reference</h3>
          <p className="body-6 text-cyan-100 [text-wrap:pretty]">{v.head}</p>
          <div className="mt-1 flex flex-wrap gap-1 caption-5">{v.tags.map((x) => <span key={x} className="rounded-md border border-cyan-500/20 px-1">{x}</span>)}</div>
          {v.rel.map((x) => <p key={x.id} className="mt-1 caption-5">Related: {x.title}</p>)}
          <p className="mt-1 caption-5 text-green-400">EIDOLON ROUTE: 8 HOPS // ACTIVE (simulated)</p></section>
        <div className="grid gap-1">
          <Btn i={Crosshair} l="LOCK CAMERA" on={() => setFocus(v.focus)} />
          <Btn i={Route} l="TRACE IP ROUTE" on={() => setMsg('Trace needs a configured backend. No request was sent.')} />
          <Btn i={Download} l="EXPORT TELEMETRY" on={exp} /></div>
        {msg && <p role="alert" className="caption-5 text-amber-400">{msg}</p>}
      </>}
    </aside>
  );
}
