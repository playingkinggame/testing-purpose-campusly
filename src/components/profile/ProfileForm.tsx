import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/TagInput';
import { friendlyError } from '@/lib/errors';
import {
  BRANCH_SUGGESTIONS, CLUB_SUGGESTIONS, HOSTEL_BLOCK_SUGGESTIONS, INTEREST_SUGGESTIONS, LANGUAGE_SUGGESTIONS, SCHOOL_SUGGESTIONS,
} from '@/lib/constants';
import { isUsernameAvailable, updateMyProfile } from '@/lib/api/profiles';
import { compressImage, removeFile, uploadFile, validateFile } from '@/lib/api/storage';
import { batchFromRegNo, cn, isValidUrl } from '@/lib/utils';
import type { MyProfile, ProfilePatch, Residence } from '@/types/db';

interface Props {
  mode: 'onboarding' | 'edit';
  initial: MyProfile;
  onSaved: (p: MyProfile) => void;
  onCancel?: () => void;
}

type Errors = Partial<Record<'full_name' | 'username' | 'reg_no' | 'batch' | 'branch' | 'school' | 'residence' | 'bio' | 'social_link' | 'avatar' | 'form', string>>;
type NameState = 'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'same';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const REG_RE = /^[0-9]{2}[a-z]{3}[0-9]{4}$/i;

export function ProfileForm({ mode, initial, onSaved, onCancel }: Props) {
  const [fullName, setFullName] = useState(initial.full_name ?? '');
  const [username, setUsername] = useState(initial.username ?? '');
  const [regNo, setRegNo] = useState(initial.reg_no ?? '');
  const [batch, setBatch] = useState(initial.batch ? String(initial.batch) : '');
  const [batchTouched, setBatchTouched] = useState(!!initial.batch);
  const [branch, setBranch] = useState(initial.branch ?? '');
  const [school, setSchool] = useState(initial.school ?? '');
  const [residence, setResidence] = useState<Residence | ''>(initial.residence ?? '');
  const [hostelBlock, setHostelBlock] = useState(initial.hostel_block ?? '');
  const [roomNo, setRoomNo] = useState(initial.room_no ?? '');
  const [clubs, setClubs] = useState<string[]>(initial.clubs);
  const [languages, setLanguages] = useState<string[]>(initial.languages);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [bio, setBio] = useState(initial.bio ?? '');
  const [socialLink, setSocialLink] = useState(initial.social_link ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [nameState, setNameState] = useState<NameState>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const regLocked = !!initial.reg_no;

  // Fill the batch year from the registration number (until the person edits it themselves)
  useEffect(() => {
    if (batchTouched) return;
    const b = batchFromRegNo(regNo);
    if (b) setBatch(String(b));
  }, [regNo, batchTouched]);

  // Check the username after a short pause in typing
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) { setNameState('idle'); return; }
    if (!USERNAME_RE.test(u)) { setNameState('invalid'); return; }
    if (u === (initial.username ?? '')) { setNameState('same'); return; }
    setNameState('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(u);
        if (!cancelled) setNameState(free ? 'free' : 'taken');
      } catch {
        if (!cancelled) setNameState('idle');
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, initial.username]);

  // Local photo preview
  useEffect(() => {
    if (!avatarFile) { setPreview(null); return; }
    const url = URL.createObjectURL(avatarFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    // Big photos are fine: we shrink them before upload. Only the type is checked here.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setErrors((e) => ({ ...e, avatar: 'Please choose a JPG, PNG or WebP photo.' }));
      return;
    }
    setErrors((e) => ({ ...e, avatar: undefined }));
    setAvatarFile(f);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (fullName.trim().length < 2 || fullName.trim().length > 60) e.full_name = 'Enter your full name (2 to 60 letters).';
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) e.username = 'Use 3 to 20 lowercase letters, numbers or underscores.';
    else if (nameState === 'taken') e.username = 'That username is taken. Try another.';
    if (!REG_RE.test(regNo.trim())) e.reg_no = 'Looks wrong. Example: 23BCE1001';
    const b = Number(batch);
    if (!b || b < 2015 || b > 2040) e.batch = 'Enter your batch year, like 2023.';
    if (!branch.trim()) e.branch = 'Choose or type your branch.';
    if (!school.trim()) e.school = 'Choose or type your school.';
    if (!residence) e.residence = 'Tell us if you are a day scholar or hosteller.';
    if (bio.length > 300) e.bio = 'Bio can be at most 300 characters.';
    if (socialLink.trim() && !isValidUrl(socialLink)) e.social_link = 'Link must start with http:// or https://';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSaving(true);
    let newPath: string | null = null;
    try {
      if (avatarFile) {
        const blob = await compressImage(avatarFile, 640);
        const bad = validateFile('avatars', { size: blob.size, type: blob.type || 'image/jpeg' });
        if (bad) throw new Error(bad);
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        newPath = await uploadFile('avatars', `${initial.id}/avatar-${Date.now()}.${ext}`, blob, blob.type || 'image/jpeg');
      }
      const isHost = residence === 'hosteller';
      const patch: ProfilePatch = {
        full_name: fullName.trim().replace(/\s+/g, ' '),
        username: username.trim().toLowerCase(),
        batch: Number(batch),
        branch: branch.trim(),
        school: school.trim(),
        residence: residence as Residence,
        hostel_block: isHost ? hostelBlock.trim() || null : null, // database rule: only hostellers
        room_no: isHost ? roomNo.trim() || null : null,
        clubs, languages, interests,
        bio: bio.trim() || null,
        social_link: socialLink.trim() || null,
      };
      if (!regLocked) patch.reg_no = regNo.trim().toUpperCase();
      if (newPath) patch.avatar_path = newPath;
      if (mode === 'onboarding') patch.onboarded = true;
      const saved = await updateMyProfile(initial.id, patch);
      if (newPath && initial.avatar_path && initial.avatar_path !== newPath) void removeFile('avatars', initial.avatar_path);
      onSaved(saved);
    } catch (err) {
      if (newPath) void removeFile('avatars', newPath);
      setErrors({ form: err instanceof Error && !('code' in err) ? err.message : friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  const nameHint =
    nameState === 'checking' ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking…</span>
    : nameState === 'free' ? <span className="inline-flex items-center gap-1 text-forest"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Username is free</span>
    : nameState === 'taken' ? <span className="inline-flex items-center gap-1 text-danger-ink"><XCircle className="h-4 w-4" aria-hidden="true" /> Already taken</span>
    : 'Lowercase letters, numbers and underscores. 3 to 20 characters.';

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <Avatar src={preview} path={initial.avatar_path} name={fullName || 'You'} size={88} />
        <div className="space-y-1.5">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-input"
            onChange={(e) => pickFile(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden="true" /> {preview || initial.avatar_path ? 'Change photo' : 'Add a photo'}
          </Button>
          <p className="text-sm text-muted">JPG, PNG or WebP. We shrink it for you.</p>
          {errors.avatar && <p role="alert" className="text-sm text-danger-ink">{errors.avatar}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.full_name} autoComplete="name" maxLength={60} />
        <Input label="Username" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
          error={errors.username} hint={nameHint} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} />
        <Input label="Registration number" required value={regNo} onChange={(e) => setRegNo(e.target.value.toUpperCase())}
          error={errors.reg_no} disabled={regLocked} maxLength={9} placeholder="23BCE1001"
          hint={regLocked ? 'This cannot be changed after it is saved.' : 'You can hide it from others later in Privacy.'} />
        <Input label="Batch (joining year)" required type="number" inputMode="numeric" min={2015} max={2040} value={batch}
          onChange={(e) => { setBatch(e.target.value); setBatchTouched(true); }} error={errors.batch} />
        <Input label="Branch" required list="branch-list" value={branch} onChange={(e) => setBranch(e.target.value)} error={errors.branch} placeholder="CSE" />
        <Input label="School" required list="school-list" value={school} onChange={(e) => setSchool(e.target.value)} error={errors.school} placeholder="SCOPE" />
        <datalist id="branch-list">{BRANCH_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>
        <datalist id="school-list">{SCHOOL_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>
        <datalist id="block-list">{HOSTEL_BLOCK_SUGGESTIONS.map((b) => <option key={b} value={b} />)}</datalist>
      </div>

      {/* Residence */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-forest">Where do you stay? <span className="text-danger-ink" aria-hidden="true">*</span></legend>
        <div className="grid grid-cols-2 gap-3">
          {([['day_scholar', 'Day scholar'], ['hosteller', 'Hosteller']] as const).map(([val, label]) => (
            <label key={val} className={cn(
              'flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-forest',
              residence === val ? 'border-forest bg-brand text-white' : 'border-line bg-surface/80 text-forest hover:bg-mint/50',
            )}>
              <input type="radio" name="residence" value={val} checked={residence === val} onChange={() => setResidence(val)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        {errors.residence && <p role="alert" className="text-sm text-danger-ink">{errors.residence}</p>}
        {residence === 'hosteller' && (
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <Input label="Hostel block" list="block-list" value={hostelBlock} onChange={(e) => setHostelBlock(e.target.value)} placeholder="A Block" />
            <Input label="Room number" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} maxLength={10}
              hint="Only you can see your room number. It is never shown to others." />
          </div>
        )}
      </fieldset>

      <TagInput label="Clubs" value={clubs} onChange={setClubs} max={10} suggestions={CLUB_SUGGESTIONS} placeholder="Add a club" />
      <TagInput label="Languages" value={languages} onChange={setLanguages} max={10} suggestions={LANGUAGE_SUGGESTIONS} placeholder="Add a language" />
      <TagInput label="Interests" value={interests} onChange={setInterests} max={15} suggestions={INTEREST_SUGGESTIONS}
        placeholder="Add an interest" hint="Interests help us find people you may vibe with." />

      <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} error={errors.bio}
        hint={`${bio.length}/300`} placeholder="A line or two about you" />
      <Input label="Social link" type="url" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} error={errors.social_link}
        placeholder="https://github.com/yourname" hint="Optional. Instagram, GitHub, LinkedIn…" />

      {errors.form && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{errors.form}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" size="lg" loading={saving}>{mode === 'onboarding' ? 'Finish and enter Campusly' : 'Save changes'}</Button>
      </div>
    </form>
  );
}
