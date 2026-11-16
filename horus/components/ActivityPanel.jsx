'use client';
import { Activity, Radio, Rss, AlertTriangle } from 'lucide-react';
import { useHorus } from './store';

export default function ActivityPanel() {
  const activity = useHorus((state) => state.activity);
  return (
    <aside className="glass flex min-h-0 flex-col gap-2 p-2">
      <div className="flex items-center gap-2 caption-3"><Activity size={15} className="text-cyan-300" />SYSTEM ACTIVITY</div>
      {!activity ? (
        <div className="glass-inner p-3 caption-5 text-amber-300">ACTIVITY MONITOR UNAVAILABLE</div>
      ) : (
        <>
          <div className="glass-inner grid grid-cols-2 gap-2 p-2 caption-5">
            <div><Radio size={12} className="mr-1 inline text-green-400" />BROKER <span className="text-green-400">{activity.status}</span></div>
            <div>WS CLIENTS <span className="text-cyan-100">{activity.websocket_clients}</span></div>
            <div><Rss size={12} className="mr-1 inline text-cyan-300" />FEED REQUESTS <span className="text-cyan-100">{activity.feed_requests}</span></div>
            <div><AlertTriangle size={12} className="mr-1 inline text-amber-300" />FAILURES <span className="text-amber-300">{activity.feed_failures}</span></div>
            <div>EVENTS SENT <span className="text-cyan-100">{activity.events_broadcast}</span></div>
          </div>
          <div className="glass-inner p-2 caption-5">
            <div className="mb-1 text-cyan-300">LAST FEED SUCCESS</div>
            {Object.entries(activity.last_success || {}).map(([source, timestamp]) => (
              <div key={source} className="flex justify-between gap-2">
                <span>{source}</span><span className="text-cyan-100">{new Date(timestamp).toISOString().slice(11, 19)}Z</span>
              </div>
            ))}
            {!Object.keys(activity.last_success || {}).length && <span className="text-slate-400">NO PUBLIC FEED SUCCESS YET</span>}
          </div>
        </>
      )}
    </aside>
  );
}
