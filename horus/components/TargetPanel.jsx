'use client';
import { useRef, useState } from 'react';
import { Search, ImageUp, MapPin } from 'lucide-react';
import { useHorus, CAT } from './store';
const MODES = ['Username', 'Lat/Long', 'Phone'];
export default function TargetPanel() {
  const { events, filters, sourceFilters, severityFilters, selected, setFocus, select } = useHorus();
  const [mode, setMode] = useState('Username'), [q, setQ] = useState(''), [err, setErr] = useState(''), file = useRef();
  const lock = (ev) => {
    ev.preventDefault(); setErr('');
    if (mode === 'Lat/Long') {
      const [lat, lon] = q.split(',').map(Number);
      if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return setErr('Enter as lat, long. Example: 35.69, 51.39');
      return setFocus({ lat, lon });
    }
    setErr('No match in the local index. Connect a lookup provider to resolve this target.');
  };
  const list = events.filter((e) => filters[e.cat] && sourceFilters[e.source] !== false && severityFilters[e.severity] !== false);
  return (
    <aside className="glass flex min-h-0 flex-col gap-2 p-2">
      <form onSubmit={lock} className="glass-inner flex flex-col gap-2 p-2">
        <h2 className="caption-3">Target lock</h2>
        <div className="flex gap-1">{MODES.map((m) => (
          <button type="button" key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
            className={`ui flex-1 rounded-md border p-1 caption-5 hover:bg-cyan-500/10 ${mode === m ? 'border-cyan-400 text-cyan-200' : 'border-cyan-500/20'}`}>{m}</button>))}</div>
        <div className="flex gap-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'Lat/Long' ? '35.69, 51.39' : `Search ${mode.toLowerCase()}`}
            aria-label="Target query" className="body-6 min-w-0 flex-1 rounded-md border border-cyan-500/20 bg-slate-950 p-2 text-cyan-100 outline-none focus:border-cyan-400" />
          <button aria-label="Search" className="ui rounded-md border border-cyan-500/30 p-2 hover:bg-cyan-500/10"><Search size={16} /></button>
          <button type="button" aria-label="Upload image" onClick={() => file.current.click()} className="ui rounded-md border border-cyan-500/30 p-2 hover:bg-cyan-500/10"><ImageUp size={16} /></button>
          <input ref={file} type="file" accept="image/*" hidden onChange={() => setErr('Image matching needs a configured backend. Nothing was uploaded.')} />
        </div>
        {err && <p role="alert" className="caption-5 text-red-400">{err}</p>}
      </form>
      <h2 className="caption-3 px-1">Geotagged feed</h2>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {list.length === 0 && <li className="glass-inner p-3 caption-5">All categories are filtered out. Enable one in the bottom bar to see events.</li>}
        {list.map((e) => (
          <li key={e.id}><button onClick={() => { select(e.id); setFocus({ lat: e.lat, lon: e.lon }); }}
            className={`ui glass-inner w-full p-3 text-left hover:bg-cyan-500/10 ${selected === e.id ? '!border-cyan-400' : ''}`}>
            <div className="flex items-center gap-2 caption-3" style={{ color: CAT[e.cat].color }}><span className="size-2 rounded-full" style={{ background: CAT[e.cat].color }} />{CAT[e.cat].label}</div>
            <p className="title-4 mt-1 text-cyan-100 [text-wrap:pretty]">{e.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1 caption-5">
              <span className="rounded-md border border-cyan-500/20 px-1">{e.source || 'LOCAL'}</span>
              <span className="rounded-md border border-cyan-500/20 px-1">{e.severity || 'UNKNOWN'}</span>
              {e.tags.map((t) => <span key={t} className="rounded-md border border-cyan-500/20 px-1">{t}</span>)}
              <span className="ml-auto flex items-center gap-1"><MapPin size={12} />{e.lat.toFixed(2)}, {e.lon.toFixed(2)}</span>
            </div></button></li>))}
      </ul>
    </aside>
  );
}
