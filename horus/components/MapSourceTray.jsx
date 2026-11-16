'use client';
import { Map, Satellite, Sparkles } from 'lucide-react';
import { MAP_SOURCES, useHorus } from './store';

const ICONS = { tactical: Satellite, photorealistic: Sparkles, open: Map };

export default function MapSourceTray() {
  const { mapSource, setMapSource } = useHorus();
  return (
    <section className="hud-card w-full max-w-md p-2" aria-label="Map source">
      <div className="mb-1 flex items-center justify-between caption-3 text-cyan-300">
        <span>MAP SOURCE TRAY</span><span className="text-cyan-400/60">HORUS ADAPTER</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(MAP_SOURCES).map(([key, source]) => {
          const Icon = ICONS[key];
          const active = mapSource === key;
          return (
            <button key={key} onClick={() => setMapSource(key)} aria-pressed={active}
              className={`ui glass-inner flex min-h-14 flex-col items-center justify-center gap-1 p-1 text-center ${active ? 'border-cyan-300 bg-cyan-500/10 text-cyan-100' : 'text-slate-400 hover:text-cyan-200'}`}>
              <Icon size={15} /><span className="caption-3">{source.label}</span>
              <span className="caption-5 text-slate-500">{source.detail}</span>
            </button>
          );
        })}
      </div>
      {mapSource !== 'tactical' && (
        <p className="mt-1 caption-5 text-amber-300/80">
          {mapSource === 'photorealistic'
            ? 'PROVIDER REQUIRED :: configure Google Maps 3D Tiles before enabling photorealistic terrain.'
            : 'OPEN ADAPTER READY :: live terrain sources can be connected without changing the HORUS HUD.'}
        </p>
      )}
    </section>
  );
}
