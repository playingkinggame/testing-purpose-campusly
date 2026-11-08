import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

async function waveformFrom(blob: Blob): Promise<number[] | null> {
  try {
    const buffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buffer.slice(0));
    const channel = audio.getChannelData(0);
    const bars = 48;
    const block = Math.max(1, Math.floor(channel.length / bars));
    const out: number[] = [];
    for (let i = 0; i < bars; i += 1) {
      let peak = 0;
      for (let j = 0; j < block; j += 1) peak = Math.max(peak, Math.abs(channel[i * block + j] ?? 0));
      out.push(Math.min(100, Math.round(peak * 100)));
    }
    await ctx.close();
    return out;
  } catch { return null; }
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VoiceRecorder({ onRecorded, onCancel }: {
  onRecorded: (blob: Blob, durationMs: number, waveform: number[] | null) => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const recordedRef = useRef(onRecorded);
  recordedRef.current = onRecorded;

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('Voice recording is not supported in this browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
        recorderRef.current = recorder;
        chunksRef.current = [];
        startedRef.current = Date.now();
        recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (cancelledRef.current) return;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const duration = Math.max(500, Math.min(600000, Date.now() - startedRef.current));
          void waveformFrom(blob).then((waveform) => recordedRef.current(blob, duration, waveform));
        };
        recorder.start();
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
          setSeconds(elapsed);
          if (elapsed >= 120 && recorder.state === 'recording') recorder.stop();
        }, 250);
      } catch { if (mounted) setError('Microphone permission is needed to record a voice note.'); }
    };
    void start();
    return () => {
      mounted = false;
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };
  const cancel = () => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={cancel}><X className="h-4 w-4" aria-hidden="true" /> Close</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-mint/60 px-3 py-2" role="status" aria-live="polite">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-forest">
        <Mic className="h-4 w-4" aria-hidden="true" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" /> Recording {clock(seconds)}
      </span>
      <span className="text-xs text-muted">Up to 2 minutes</span>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" onClick={stop}><Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop & send</Button>
        <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );
}
