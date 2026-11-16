'use client';
import { useEffect, useRef, useState } from 'react';
// SIMULATED market data (random walk). Wire to a real feed before use.
const SYMS = [['WTI CRUDE', 78.4], ['GOLD', 2310.2], ['BTC', 64120], ['EUR/USD', 1.0831], ['USD/INR', 83.27]];
function Spark({ pts, up }) {
  const mn = Math.min(...pts), mx = Math.max(...pts), d = pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${28 - ((v - mn) / (mx - mn || 1)) * 26}`).join(' ');
  return <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true"><polyline points={d} fill="none" stroke={up ? '#22c55e' : '#FF0033'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}
export default function TradeCommsPanel() {
  const [s, setS] = useState(SYMS.map(([n, v]) => ({ n, hist: Array(30).fill(v) }))), [log, setLog] = useState([]), box = useRef();
  useEffect(() => {
    const i = setInterval(() => {
      setS((p) => p.map((x) => ({ ...x, hist: [...x.hist.slice(1), x.hist.at(-1) * (1 + (Math.random() - 0.5) * 0.002)] })));
      const peer = Math.random().toString(16).slice(2, 6), rtt = Math.round(30 + Math.random() * (Math.random() > 0.9 ? 220 : 40));
      const kinds = ['SIP INVITE', 'SIP 200 OK', 'RTP seq ' + Math.floor(Math.random() * 65535), 'DTLS handshake'];
      setLog((l) => [...l.slice(-40), `${new Date().toISOString().slice(11, 19)} peer ${peer} ${kinds[Math.floor(Math.random() * 4)]} rtt ${rtt}ms${rtt > 120 ? ' SPIKE' : ''}`]);
    }, 1200);
    return () => clearInterval(i);
  }, []);
  useEffect(() => { if (box.current) box.current.scrollTop = 1e6; }, [log]);
  return (
    <aside className="glass flex min-h-0 flex-col gap-2 p-2">
      <h2 className="caption-3 px-1">Markets (simulated)</h2>
      {s.map((x) => { const l = x.hist.at(-1); return (
        <div key={x.n} className="glass-inner flex items-center gap-3 p-2">
          <div className="w-24"><div className="caption-5">{x.n}</div><div className="title-4 text-cyan-100 tabular-nums">{l.toFixed(l < 10 ? 4 : 2)}</div></div>
          <Spark pts={x.hist} up={l >= x.hist[0]} /></div>); })}
      <h2 className="caption-3 px-1">VoIP and comms stream</h2>
      <div ref={box} className="glass-inner min-h-0 flex-1 overflow-y-auto p-2 caption-5">
        {log.map((l, i) => <div key={i} className={l.includes('SPIKE') ? 'text-amber-400' : ''}>{l}</div>)}</div>
    </aside>
  );
}
