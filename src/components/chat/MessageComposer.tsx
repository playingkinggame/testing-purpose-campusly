import { useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { VoiceRecorder } from './VoiceRecorder';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';

const EMOJI = ['😀', '😂', '❤️', '👍', '🙏'];

interface Props {
  disabled?: boolean;
  replyTo?: { name: string; body: string } | null;
  onCancelReply: () => void;
  onSendText: (text: string) => Promise<boolean>;
  onSendFile: (file: File) => Promise<void>;
  onSendVoice: (blob: Blob, durationMs: number, waveform: number[] | null) => Promise<void>;
  onTyping: () => void;
}

export function MessageComposer({ disabled, replyTo, onCancelReply, onSendText, onSendFile, onSendVoice, onTyping }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try { if (await onSendText(value)) setText(''); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); textRef.current?.focus(); }
  };

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try { await onSendFile(file); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const recorded = async (blob: Blob, durationMs: number, waveform: number[] | null) => {
    setRecording(false);
    setBusy(true);
    try { await onSendVoice(blob, durationMs, waveform); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  if (disabled) {
    return <div className="border-t border-line bg-mint/30 px-4 py-3 text-center text-sm text-muted">You can view this chat, but you can no longer send messages.</div>;
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface/40 p-2 sm:p-3">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-mint/50 px-3 py-2 text-xs text-forest">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Replying to {replyTo.name}</p>
            <p className="truncate text-muted">{replyTo.body}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="rounded-full p-1 hover:bg-forest/10"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      )}

      {recording ? (
        <VoiceRecorder onRecorded={(blob, ms, wave) => void recorded(blob, ms, wave)} onCancel={() => setRecording(false)} />
      ) : (
        <>
          <div className="mb-1 flex flex-wrap gap-1" aria-label="Quick emoji">
            {EMOJI.map((emoji) => (
              <button key={emoji} type="button" onClick={() => { setText((v) => `${v}${emoji}`); textRef.current?.focus(); }} className="rounded-lg px-1.5 py-0.5 text-lg leading-none hover:bg-mint/60" aria-label={`Add ${emoji}`}>{emoji}</button>
            ))}
          </div>
          <div className="flex items-end gap-1.5">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Choose a file to send" onChange={(e) => void upload(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" aria-label="Send a file" disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip className="h-5 w-5" aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" aria-label="Send a photo" disabled={busy} onClick={() => fileRef.current?.click()}><ImageIcon className="h-5 w-5" aria-hidden="true" /></Button>
            <Button variant="ghost" size="sm" aria-label="Record a voice note" disabled={busy} onClick={() => setRecording(true)}><Mic className="h-5 w-5" aria-hidden="true" /></Button>
            <textarea ref={textRef} value={text} onChange={(e) => { setText(e.target.value); onTyping(); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} rows={1} maxLength={4000} placeholder="Write a message…" aria-label="Message" className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-line bg-surface/80 px-4 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-forest" />
            <Button size="sm" aria-label="Send message" loading={busy} disabled={!text.trim()} onClick={() => void submit()}><Send className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
          {text.length > 3500 && <p className="mt-1 text-right text-[11px] text-muted">{text.length}/4000</p>}
        </>
      )}
    </div>
  );
}
