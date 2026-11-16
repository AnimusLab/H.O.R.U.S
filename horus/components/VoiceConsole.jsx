'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { findPlace, useHorus } from './store';

export function interpretVoiceCommand(command, state = useHorus.getState()) {
  const text = command.trim().toLowerCase();
  if (!text) return { ok: false, message: 'No command heard' };
  if (/\b(3d|globe|orbital)\b/.test(text)) state.setMode('3d');
  else if (/\b(2d|flat|map)\b/.test(text)) state.setMode('2d');
  if (/\b(flights?|aircraft)\b/.test(text) && !state.layers.air) state.toggleLayer('air');
  if (/\b(ships?|maritime|vessels?)\b/.test(text) && !state.layers.ships) state.toggleLayer('ships');
  if (/\b(satellites?|orbit)\b/.test(text) && !state.layers.sats) state.toggleLayer('sats');
  const place = findPlace(text.replace(/\b(take me to|go to|show me|fly to)\b/g, '').trim());
  if (place) state.setFocus({ lat: place.coordinates[0], lon: place.coordinates[1] });
  if (/\b(reset|home|global view)\b/.test(text)) state.setFocus(null);
  return { ok: true, message: `COMMAND ACCEPTED :: ${command.toUpperCase()}` };
}

export default function VoiceConsole() {
  const recognition = useRef(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('VOICE LINK STANDBY');
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => () => recognition.current?.abort(), []);

  const toggle = () => {
    if (!supported) { setMessage('VOICE UNAVAILABLE :: USE A SPEECH-ENABLED BROWSER'); return; }
    if (listening) { recognition.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const next = new SpeechRecognition();
    next.lang = 'en-US';
    next.interimResults = false;
    next.onstart = () => { setListening(true); setMessage('LISTENING FOR HORUS COMMAND'); };
    next.onresult = ({ results }) => {
      const command = results[0][0].transcript;
      setMessage(interpretVoiceCommand(command).message);
    };
    next.onerror = () => setMessage('VOICE ERROR :: COMMAND NOT EXECUTED');
    next.onend = () => setListening(false);
    recognition.current = next;
    next.start();
  };

  return (
    <section className="hud-card w-full max-w-md p-2" aria-label="Voice command">
      <div className="flex items-center gap-2">
        <button onClick={toggle} aria-pressed={listening} className="ui glass-inner flex items-center gap-2 p-2 hover:bg-cyan-500/10">
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
          <span className="caption-3">{listening ? 'STOP LISTENING' : 'HORUS VOICE'}</span>
        </button>
        <span className="caption-5 text-cyan-200/70">{message}</span>
      </div>
      <p className="mt-1 caption-5 text-slate-500">Try: “take me to Tehran”, “show flights”, or “switch to 3D”.</p>
    </section>
  );
}
