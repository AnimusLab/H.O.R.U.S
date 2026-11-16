// Tactical frame: corner crosshairs plus coordinate style tick marks along the viewport edges.
const tick = (dir, gap) => ({ backgroundImage: `repeating-linear-gradient(${dir}, rgba(56,189,248,.6) 0 1px, transparent 1px ${gap}px)` });
const Plus = ({ c }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={`absolute text-cyan-400/80 ${c}`}><path d="M12 1v22M1 12h22" stroke="currentColor" strokeWidth="1" fill="none" /></svg>);
export default function Reticles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[4]" aria-hidden="true">
      <Plus c="left-2 top-2" /><Plus c="right-2 top-2" /><Plus c="bottom-2 left-2" /><Plus c="bottom-2 right-2" />
      {[['inset-x-10 top-0', '90deg'], ['inset-x-10 bottom-0', '90deg'], ['inset-y-10 left-0', '180deg'], ['inset-y-10 right-0', '180deg']].map(([c, d]) => {
        const h = d === '90deg';
        return (<div key={c}><div className={`absolute ${c} ${h ? 'h-1.5' : 'w-1.5'}`} style={tick(d, 20)} /><div className={`absolute ${c} ${h ? 'h-3' : 'w-3'}`} style={tick(d, 100)} /></div>);
      })}
    </div>
  );
}
