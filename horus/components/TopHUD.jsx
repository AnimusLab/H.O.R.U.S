'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, Ghost, Radar, Gauge } from 'lucide-react';
import { useHorus } from './store';
export default function TopHUD() {
  const [now, setNow] = useState(null);
  const { networkLatency, defcon, distanceKm, feedStatusBySource, telemetryConnected } = useHorus();
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); setNow(new Date()); return () => clearInterval(i); }, []);
  return (
    <header className="glass flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2"><Radar size={20} className="text-cyan-400" />
        <h1 className="title-4 tracking-widest">H.O.R.U.S. :: SYSTEM ACTIVE</h1></div>
      <div className="flex flex-wrap items-center gap-2 caption-3">
        <span className="glass-inner flex items-center gap-2 p-2"><ShieldCheck size={14} className="text-green-400" />
          SARCOPHAGUS OS: <span className="text-green-400">[SECURE // RAM-ONLY]</span></span>
        <span className="glass-inner flex items-center gap-2 p-2"><Ghost size={14} />TELEMETRY: [{telemetryConnected ? 'CONNECTED' : 'LOCAL DEMO'}] <span className="text-cyan-300">{networkLatency}</span></span>
        <span className="glass-inner p-2">GEO FFI: {distanceKm == null ? '--' : `${distanceKm.toFixed(1)}km`}</span>
        {Object.entries(feedStatusBySource).map(([source, feed]) => (
          <span className="glass-inner p-2" key={source}>
            {source}: <span className={feed.status === 'ERROR' ? 'text-red-400' : 'text-green-400'}>[{feed.status}]</span>
            {feed.lastSuccess && <span className="text-slate-400"> {Math.max(0, Math.round((Date.now() - Date.parse(feed.lastSuccess)) / 1000))}s AGO</span>}
          </span>
        ))}
        <span className="glass-inner p-2 tabular-nums">{now ? now.toISOString().slice(11, 19) : '--:--:--'} UTC</span>
        <span className="glass-inner flex items-center gap-2 p-2 text-amber-400"><Gauge size={14} />DEFCON: {defcon} (ELEVATED)</span>
      </div>
    </header>
  );
}
