import { useEffect, useState, type FormEvent } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { submitReport } from '@/lib/api/reports';
import { cn } from '@/lib/utils';
import type { ReportReason, ReportTarget } from '@/types/db';

const TARGET_LABEL: Record<ReportTarget, string> = {
  profile: 'profile',
  message: 'message',
  post: 'post',
  confession: 'confession',
  group: 'group',
  event: 'event',
};

const REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'spam', label: 'Spam or scam', hint: 'Repeated messages, fake links or advertising.' },
  { value: 'harassment', label: 'Harassment or bullying', hint: 'Threats, repeated unwanted contact or intimidation.' },
  { value: 'hate', label: 'Hate speech', hint: 'Attacks based on religion, caste, gender, sexuality or identity.' },
  { value: 'nsfw', label: 'Sexual or explicit content', hint: 'Nudity or sexual content that does not belong here.' },
  { value: 'impersonation', label: 'Impersonation', hint: 'Pretending to be another student, club or official.' },
  { value: 'self_harm', label: 'Self-harm concern', hint: 'Someone may be at risk of hurting themselves.' },
  { value: 'other', label: 'Something else', hint: 'Tell us briefly what happened.' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  targetName?: string | null;
}

export function ReportDialog({ open, onClose, targetType, targetId, targetName }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setDetails('');
    setError(null);
  }, [open, targetId, targetType]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError('Please choose a reason.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitReport({ targetType, targetId, reason, details });
      toast.success('Report sent. Our admins will review it.');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Report this ${TARGET_LABEL[targetType]}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="report-form" loading={saving}>Send report</Button>
        </>
      }
    >
      <form id="report-form" onSubmit={submit} className="space-y-4">
        <p className="flex items-start gap-2 rounded-2xl bg-mint/50 px-3 py-2 text-sm text-forest">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {targetName ? <>You are reporting <strong>{targetName}</strong>. </> : null}
            Reports are private. The person is not told who reported them.
          </span>
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-forest">What is wrong?</legend>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-forest',
                  reason === r.value ? 'border-forest bg-mint/50' : 'border-line bg-surface/70 hover:bg-mint/30',
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-forest"
                />
                <span>
                  <span className="block text-sm font-semibold text-forest">{r.label}</span>
                  <span className="block text-xs text-muted">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Textarea
          label="Anything else? (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          hint={`${details.length}/500`}
          placeholder="Add a short note for the admins"
        />

        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</p>}
      </form>
    </Modal>
  );
}
