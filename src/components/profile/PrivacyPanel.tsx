import { useState } from 'react';
import { Clock, EyeOff, Hash, Lock, ShieldCheck, Unlock, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { listBlocked, unblockUser } from '@/lib/api/blocks';
import { updateMyProfile } from '@/lib/api/profiles';
import { cn, timeAgo } from '@/lib/utils';
import type { ProfilePatch } from '@/types/db';

type PrivacyKey = 'hide_online' | 'hide_last_seen' | 'hide_reg_no';

const ITEMS: Array<{ key: PrivacyKey; label: string; hint: string; icon: typeof EyeOff }> = [
  {
    key: 'hide_online',
    label: 'Hide online status',
    hint: 'You will not appear online. Your last seen time is hidden too.',
    icon: EyeOff,
  },
  {
    key: 'hide_last_seen',
    label: 'Hide last seen',
    hint: 'Others will not see when you were last active.',
    icon: Clock,
  },
  {
    key: 'hide_reg_no',
    label: 'Hide registration number',
    hint: 'Your registration number will not appear on your public profile.',
    icon: Hash,
  },
];

function Toggle({
  checked,
  onChange,
  label,
  busy,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={busy}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
        checked ? 'bg-brand' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function PrivacyPanel() {
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const blocked = useAsync(listBlocked, []);
  const [busy, setBusy] = useState<PrivacyKey | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  if (!profile) return null;

  const toggle = async (key: PrivacyKey) => {
    setBusy(key);
    try {
      const patch: ProfilePatch =
        key === 'hide_online'
          ? { hide_online: !profile.hide_online }
          : key === 'hide_last_seen'
            ? { hide_last_seen: !profile.hide_last_seen }
            : { hide_reg_no: !profile.hide_reg_no };
      const saved = await updateMyProfile(profile.id, patch);
      setProfile(saved);
      toast.success('Privacy updated.');
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleUnblock = async (userId: string) => {
    setUnblocking(userId);
    try {
      await unblockUser(userId);
      toast.success('Person unblocked.');
      await blocked.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setUnblocking(null);
    }
  };

  const rows = blocked.data ?? [];

  return (
    <section aria-labelledby="privacy-heading" className="space-y-4">
      <div>
        <h2 id="privacy-heading" className="flex items-center gap-2 text-lg font-semibold text-forest">
          <Lock className="h-5 w-5" aria-hidden="true" /> Privacy & safety
        </h2>
        <p className="text-sm text-muted">Control what others see. These changes save immediately.</p>
      </div>

      <Card className="divide-y divide-line/70 !p-0">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const checked = profile[item.key];
          return (
            <div key={item.key} className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest" aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p id={`${item.key}-label`} className="text-sm font-semibold text-forest">{item.label}</p>
                <p className="text-sm text-muted">{item.hint}</p>
              </div>
              <Toggle
                checked={checked}
                onChange={() => void toggle(item.key)}
                label={item.label}
                busy={busy === item.key}
              />
            </div>
          );
        })}
      </Card>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-forest">
          <UserX className="h-5 w-5" aria-hidden="true" /> Blocked people
        </h3>
        <p className="text-sm text-muted">People you block disappear from Discover, your chats and your groups.</p>

        <Card className="!p-2">
          <AsyncView
            loading={blocked.loading}
            error={blocked.error}
            onRetry={() => void blocked.reload()}
            hasData={!!blocked.data}
            isEmpty={rows.length === 0}
            empty={
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Nobody blocked"
                text="You can block someone from their profile or from a message."
              />
            }
          >
            <ul className="divide-y divide-line/70">
              {rows.map((person) => (
                <li key={person.blocked_id} className="flex items-center gap-3 p-3">
                  <Avatar path={person.avatar_path} name={person.full_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{person.full_name ?? 'Someone'}</p>
                    <p className="truncate text-xs text-muted">
                      {person.username ? `@${person.username}` : 'No username'}
                      {person.blocked_at ? ` · blocked ${timeAgo(person.blocked_at)}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={unblocking === person.blocked_id}
                    onClick={() => void handleUnblock(person.blocked_id)}
                  >
                    <Unlock className="h-4 w-4" aria-hidden="true" /> Unblock
                  </Button>
                </li>
              ))}
            </ul>
          </AsyncView>
        </Card>
      </div>
    </section>
  );
}
