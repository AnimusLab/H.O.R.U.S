'use client';
import { useEffect, useRef } from 'react';
import { useHorus, CAT } from './store';
export default function BottomBar({ onToggle }) {
  const { logs, filters, toggle } = useHorus(), box = useRef();
  useEffect(() => { if (box.current) box.current.scrollTop = 1e6; }, [logs]);
  return (
    <footer className="glass flex flex-wrap items-center gap-3 p-2">
      <div ref={box} className="glass-inner h-16 min-w-64 flex-1 overflow-y-auto p-2 caption-5">
        {logs.map((l, i) => <div key={i}>{l.t} | <span className={l.lvl === 'WARN' ? 'text-amber-400' : ''}>{l.lvl}</span> | {l.msg}</div>)}</div>
      <div className="flex flex-wrap gap-2 caption-3">
        {Object.keys(CAT).map((k) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={filters[k]} className="ui glass-inner flex items-center gap-1 p-2 hover:bg-cyan-500/10"
            style={{ color: filters[k] ? CAT[k].color : '#475569' }}>[{filters[k] ? 'x' : ' '}] {CAT[k].label}</button>))}
      </div>
    <button onClick={onToggle} className="ui glass-inner p-2 caption-3 hover:bg-cyan-500/10">HUD view</button></footer>
  );
}
