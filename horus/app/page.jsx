'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import TopHUD from '../components/TopHUD';
import TargetPanel from '../components/TargetPanel';
import TradeCommsPanel from '../components/TradeCommsPanel';
import BottomBar from '../components/BottomBar';
import Reticles from '../components/Reticles';
import TargetDrawer from '../components/TargetDrawer';
import ActivityPanel from '../components/ActivityPanel';
import { Legend, SearchPill, Ticker, StatusLine, ModeSwitch, LayerMatrix } from '../components/HudLayer';
import LeaderOverlay from '../components/LeaderOverlay';
import MapSourceTray from '../components/MapSourceTray';
import VoiceConsole from '../components/VoiceConsole';
import { initActivityMonitor, initTelemetrySocket, useHorus } from '../components/store';
const Globe = dynamic(() => import('../components/GlobeViewport'), { ssr: false });
const MSG = ['Ingest cycle complete', 'Feed latency nominal', 'Entity resolver synced', 'Mesh hop rotated', 'Anomaly score recomputed'];
export default function Page() {
  const { ops, setOps } = useHorus();
  useEffect(() => {
    const i = setInterval(() => useHorus.getState().pushLog({ t: new Date().toISOString().slice(11, 19),
      lvl: Math.random() > 0.85 ? 'WARN' : 'INFO', msg: MSG[Math.floor(Math.random() * MSG.length)] }), 1500);
    const stopTelemetry = initTelemetrySocket();
    const stopActivity = initActivityMonitor();
    return () => { clearInterval(i); stopTelemetry(); stopActivity(); };
  }, []);
  return (
    <main className="tactical-shell relative h-screen w-screen">
      <div className="tactical-vignette absolute inset-0" />
      <div className="absolute inset-0"><Globe /></div>
      <Reticles />
      {!ops && <><LeaderOverlay /><LayerMatrix /><TargetDrawer /></>}
      {ops ? (
        <div className="pointer-events-none relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-3 p-3">
          <div className="pointer-events-auto"><TopHUD /></div>
          <div className="grid min-h-0 grid-cols-[320px_1fr_320px] gap-3 max-lg:grid-cols-1">
            <div className="pointer-events-auto flex min-h-0 flex-col [&>aside]:flex-1"><TargetPanel /></div>
            <div className="pointer-events-auto flex min-h-0 flex-col [&>aside]:flex-1"><ActivityPanel /></div>
            <div className="pointer-events-auto flex min-h-0 flex-col max-lg:hidden [&>aside]:flex-1"><TradeCommsPanel /></div>
          </div>
          <div className="pointer-events-auto"><BottomBar onToggle={() => setOps(false)} /></div>
        </div>
      ) : (
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between">
          <div className="tactical-topbar flex items-start justify-between gap-3 p-6 max-md:flex-col [&>*]:pointer-events-auto">
            <Legend /><div className="flex w-full max-w-md flex-col items-center gap-2"><SearchPill /><ModeSwitch /><MapSourceTray /><VoiceConsole /></div><Ticker />
          </div>
          <div className="pointer-events-auto"><StatusLine onToggle={() => setOps(true)} /></div>
        </div>
      )}
    </main>
  );
}
