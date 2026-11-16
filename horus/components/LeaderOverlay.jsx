'use client';
import { useEffect, useRef } from 'react';
import { useHorus, CAT } from './store';
import { bus } from './leaderBus';

// Full-screen SVG over the canvas. Labels are fixed HUD boxes; each leader runs from the node's live
// projected pixel position to the nearest corner of its box. Updated imperatively from inside useFrame.
export default function LeaderOverlay() {
  const { events, filters, sourceFilters, severityFilters, layers } = useHorus(), items = layers.pings ? events.filter((e) => filters[e.cat] && sourceFilters[e.source] !== false && severityFilters[e.severity] !== false && e.callout) : [];
  const root = useRef(), ln = useRef({}), dot = useRef({}), lab = useRef({});
  useEffect(() => {
    bus.update = () => {
      if (!root.current) return;
      const o = root.current.getBoundingClientRect();
      items.forEach((e) => {
        const b = bus[e.id], l = ln.current[e.id], d = dot.current[e.id], t = lab.current[e.id];
        if (!b || !l || !d || !t) return;
        const r = t.getBoundingClientRect();
        const [cx, cy] = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]
          .map(([x, y]) => [x - o.left, y - o.top])
          .reduce((m, c) => (Math.hypot(c[0] - b.x, c[1] - b.y) < Math.hypot(m[0] - b.x, m[1] - b.y) ? c : m));
        l.setAttribute('d', `M${b.x} ${b.y}L${cx} ${cy}`);
        d.setAttribute('cx', b.x); d.setAttribute('cy', b.y);
        const op = b.vis ? 1 : 0; l.style.opacity = op; d.style.opacity = op; t.style.opacity = op;
      });
    };
    return () => { bus.update = null; };
  }, [items]);
  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[5]">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {items.map((e) => (
          <g key={e.id}>
            <path ref={(r) => (ln.current[e.id] = r)} fill="none" stroke={CAT[e.cat].color} strokeOpacity=".75" style={{ transition: 'opacity .3s' }} />
            <circle ref={(r) => (dot.current[e.id] = r)} r="3" fill={CAT[e.cat].color} style={{ transition: 'opacity .3s' }} />
          </g>))}
      </svg>
      {items.map((e) => { const k = e.callout, r = k.side === 'r'; return (
        <div key={e.id} ref={(el) => (lab.current[e.id] = el)} className="hud-card absolute w-max p-2 caption-5 transition-opacity duration-300"
          style={{ left: `${k.at[0] * 100}%`, top: `${k.at[1] * 100}%`, transform: `translate(${r ? '-100%' : '0'},-50%)`, textAlign: r ? 'right' : 'left' }}>
          <div className="text-cyan-200">{k.lines[0]}</div><div style={{ color: CAT[e.cat].color }}>{k.lines[1]}</div></div>); })}
    </div>
  );
}
