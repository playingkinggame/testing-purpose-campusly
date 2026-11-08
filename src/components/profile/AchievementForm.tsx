import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, Paperclip, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import {
  createAchievement,
  updateAchievement,
  uploadAchievementFile,
  type AchievementInput,
} from '@/lib/api/achievements';
import { removeFile, validateFile } from '@/lib/api/storage';
import { fileSizeLabel } from '@/lib/utils';
import type { Achievement, AchievementKind } from '@/types/db';

const KINDS: Array<{ value: AchievementKind; label: string }> = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'fest', label: 'Fest' },
  { value: 'club_role', label: 'Club role' },
  { value: 'other', label: 'Other' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  initial: Achievement | null;
  userId: string;
  onSaved: () => void;
}

export function AchievementForm({ open, onClose, initial, userId, onSaved }: Props) {
  const [kind, setKind] = useState<AchievementKind>('certificate');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issuer, setIssuer] = useState('');
  const [achievedOn, setAchievedOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? 'certificate');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setIssuer(initial?.issuer ?? '');
    setAchievedOn(initial?.achieved_on ?? '');
    setFile(null);
    setRemoveExisting(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [open, initial]);

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const bad = validateFile('certificates', picked);
    if (bad) {
      setError(bad);
      return;
    }
    setFile(picked);
    setRemoveExisting(false);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) {
      setError('Give the achievement a title (at least 2 characters).');
      return;
    }
    if (cleanTitle.length > 120) {
      setError('Keep the title under 120 characters.');
      return;
    }
    if (description.trim().length > 500) {
      setError('Keep the description under 500 characters.');
      return;
    }
    if (issuer.trim().length > 120) {
      setError('Keep the issuer under 120 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    let newPath: string | null = null;
    try {
      if (file) newPath = await uploadAchievementFile(userId, file);
      const filePath = newPath ?? (removeExisting ? null : initial?.file_path ?? null);
      const payload: AchievementInput = {
        kind,
        title: cleanTitle,
        description: description.trim() || null,
        issuer: issuer.trim() || null,
        achieved_on: achievedOn || null,
        file_path: filePath,
      };
      if (initial) await updateAchievement(initial.id, payload);
      else await createAchievement(payload);

      if (initial?.file_path && initial.file_path !== filePath) {
        await removeFile('certificates', initial.file_path);
      }
      toast.success(initial ? 'Achievement updated.' : 'Achievement added.');
      onSaved();
    } catch (err) {
      if (newPath) await removeFile('certificates', newPath);
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const showCurrentFile = !!initial?.file_path && !removeExisting;

  return (
    <Modal
      open={open}
      title={initial ? 'Edit achievement' : 'Add achievement'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="achievement-form" loading={saving}>
            {initial ? 'Save changes' : 'Add achievement'}
          </Button>
        </>
      }
    >
      <form id="achievement-form" onSubmit={submit} className="space-y-4">
        <Select label="Type" required value={kind} onChange={(e) => setKind(e.target.value as AchievementKind)}>
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>

        <Input
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Campus Hack Night finalist"
        />

        <Input
          label="Issued by"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          maxLength={120}
          placeholder="Coding Club"
        />

        <Input
          label="Date"
          type="date"
          value={achievedOn}
          onChange={(e) => setAchievedOn(e.target.value)}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          hint={`${description.length}/500`}
          placeholder="What did you build or win?"
        />

        <div className="space-y-2">
          <p className="text-sm font-semibold text-forest">Proof (optional)</p>
          <input
            ref={fileRef}
            id="achievement-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-label="Achievement proof file"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" aria-hidden="true" /> Choose file
            </Button>
            <span className="text-sm text-muted">
              {file
                ? `${file.name} · ${fileSizeLabel(file.size)}`
                : showCurrentFile
                  ? 'Current file attached'
                  : 'No file selected'}
            </span>
          </div>
          <p className="text-sm text-muted">Image or PDF, up to 5 MB.</p>
        </div>

        {showCurrentFile && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface/70 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-forest">
              <FileText className="h-4 w-4" aria-hidden="true" /> Current file
            </span>
            <button
              type="button"
              onClick={() => setRemoveExisting(true)}
              className="font-semibold text-danger-ink hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        {removeExisting && initial?.file_path && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            <span>The current file will be removed when you save.</span>
            <button
              type="button"
              onClick={() => setRemoveExisting(false)}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
            </button>
          </div>
        )}

        {file && initial?.file_path && !removeExisting && (
          <p className="text-sm text-muted">The new file will replace the current one.</p>
        )}

        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</p>}
      </form>
    </Modal>
  );
}
