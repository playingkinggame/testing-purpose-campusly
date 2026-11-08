import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { signedUrl } from '@/lib/api/storage';
import { cn } from '@/lib/utils';

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VoicePlayer({ path, durationMs, waveform, mine }: {
  path: string; durationMs: number | null; waveform: number[] | null; mine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    signedUrl('voice-notes', path)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); } catch { setFailed(true); }
    } else { audio.pause(); setPlaying(false); }
  };

  if (failed) return <p className={cn('text-xs', mine ? 'text-white/70' : 'text-muted')}>Voice note unavailable.</p>;
  if (!url) return <p className={cn('text-xs', mine ? 'text-white/70' : 'text-muted')}>Loading voice note…</p>;

  const bars = waveform?.length ? waveform.slice(0, 48) : Array.from({ length: 30 }, () => 30);
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="flex min-w-[190px] items-center gap-2">
      <button type="button" onClick={() => void toggle()} aria-label={playing ? 'Pause voice note' : 'Play voice note'} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', mine ? 'bg-white/20 text-white' : 'bg-brand text-white')}>
        {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
        {bars.map((value, index) => (
          <span key={index} className={cn('w-[2px] rounded-full', index / bars.length <= ratio ? mine ? 'bg-white' : 'bg-brand' : mine ? 'bg-white/30' : 'bg-forest/20')} style={{ height: `${Math.max(4, Math.min(100, value) * 0.28)}px` }} />
        ))}
      </div>
      <span className={cn('shrink-0 text-[11px] tabular-nums', mine ? 'text-white/75' : 'text-muted')}>{clock(current > 0 ? current : duration)}</span>
      <audio ref={audioRef} src={url} preload="metadata" onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)} onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }} onEnded={() => { setPlaying(false); setCurrent(0); }} className="hidden" />
    </div>
  );
}
