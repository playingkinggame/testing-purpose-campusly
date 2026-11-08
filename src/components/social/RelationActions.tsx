import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Check, Clock, Flag, Heart, MessageCircle, MoreHorizontal, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/store/authStore';
import { getRelation, respond, sendRequest } from '@/lib/api/connections';
import { startDm } from '@/lib/api/conversations';
import { giveHeart, hasHeartedThisWeek } from '@/lib/api/hearts';
import { blockUser } from '@/lib/api/blocks';
import { cn } from '@/lib/utils';
import type { MiniProfile, RelationStatus } from '@/types/db';

interface Props {
  person: Pick<MiniProfile, 'id' | 'username' | 'full_name'>;
  /** Pass this when the screen already knows the relation; otherwise it is fetched. */
  initialRelation?: RelationStatus;
  connectionId?: string | null;
  onChanged?: () => void;
  onBlocked?: () => void;
  className?: string;
}

export function RelationActions({
  person,
  initialRelation,
  connectionId,
  onChanged,
  onBlocked,
  className,
}: Props) {
  const me = useAuth((s) => s.userId);
  const navigate = useNavigate();
  const [relation, setRelation] = useState<RelationStatus | null>(initialRelation ?? null);
  const [relationId, setRelationId] = useState<string | null>(connectionId ?? null);
  const [loadingRelation, setLoadingRelation] = useState(initialRelation === undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [hearted, setHearted] = useState(false);
  const [heartBusy, setHeartBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let alive = true;
    if (initialRelation === undefined) {
      setLoadingRelation(true);
      getRelation(person.id)
        .then((r) => {
          if (!alive) return;
          setRelation(r.status);
          setRelationId(r.id);
        })
        .catch(() => {
          if (alive) setRelation('none');
        })
        .finally(() => {
          if (alive) setLoadingRelation(false);
        });
    } else {
      setRelation(initialRelation);
      setRelationId(connectionId ?? null);
      setLoadingRelation(false);
    }
    return () => { alive = false; };
  }, [person.id, initialRelation, connectionId]);

  useEffect(() => {
    let alive = true;
    if (!me || person.id === me) return;
    hasHeartedThisWeek(person.id)
      .then((v) => { if (alive) setHearted(v); })
      .catch(() => { /* the button still works; the database enforces once a week */ });
    return () => { alive = false; };
  }, [person.id, me]);

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  const connect = async () => {
    setBusy('connect');
    try {
      await sendRequest(person.id);
      setRelation('pending_out');
      toast.success('Connection request sent.');
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const accept = async () => {
    setBusy('accept');
    try {
      const id = relationId ?? (await getRelation(person.id)).id;
      if (!id) throw new Error('This request is no longer available.');
      await respond(id, 'accepted');
      setRelation('accepted');
      toast.success('You are connected. Say hi!');
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    setBusy('decline');
    try {
      const id = relationId ?? (await getRelation(person.id)).id;
      if (!id) throw new Error('This request is no longer available.');
      await respond(id, 'declined');
      setRelation('declined_in');
      toast.info('Request declined.');
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const message = async () => {
    setBusy('message');
    try {
      const conversationId = await startDm(person.id);
      navigate(`/chat/${conversationId}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const heart = async () => {
    if (hearted) return;
    setHeartBusy(true);
    try {
      await giveHeart(person.id);
      setHearted(true);
      toast.success('Heart sent 💚');
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setHeartBusy(false);
    }
  };

  const confirmBlock = async () => {
    setBlockBusy(true);
    try {
      await blockUser(person.id);
      setBlockOpen(false);
      toast.success('Person blocked.');
      onBlocked?.();
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBlockBusy(false);
    }
  };

  if (!me || person.id === me) return null;

  if (loadingRelation && relation === null) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button variant="secondary" size="sm" loading>Loading</Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {relation === 'none' && (
        <Button size="sm" onClick={() => void connect()} loading={busy === 'connect'}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Connect
        </Button>
      )}

      {relation === 'pending_out' && (
        <Button variant="secondary" size="sm" disabled>
          <Clock className="h-4 w-4" aria-hidden="true" /> Pending
        </Button>
      )}

      {relation === 'pending_in' && (
        <>
          <Button size="sm" onClick={() => void accept()} loading={busy === 'accept'}>
            <Check className="h-4 w-4" aria-hidden="true" /> Accept
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void decline()} loading={busy === 'decline'}>
            <X className="h-4 w-4" aria-hidden="true" /> Decline
          </Button>
        </>
      )}

      {relation === 'accepted' && (
        <Button size="sm" onClick={() => void message()} loading={busy === 'message'}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
        </Button>
      )}

      {(relation === 'declined_out' || relation === 'declined_in') && (
        <Button variant="secondary" size="sm" disabled>
          <X className="h-4 w-4" aria-hidden="true" /> Declined
        </Button>
      )}

      <Button
        variant={hearted ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => void heart()}
        loading={heartBusy}
        disabled={hearted}
        aria-label={hearted ? 'You already sent a heart this week' : 'Send a heart'}
      >
        <Heart className={cn('h-4 w-4', hearted && 'fill-current')} aria-hidden="true" />
        {hearted ? 'Hearted' : 'Heart'}
      </Button>

      <details ref={menuRef} className="relative">
        <summary
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-2xl text-forest hover:bg-mint/60 [&::-webkit-details-marker]:hidden"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </summary>
        <div className="app-pop-menu absolute right-0 z-30 mt-1 w-44 rounded-2xl border border-line bg-surface p-1 shadow-xl">
          <button
            type="button"
            onClick={() => { closeMenu(); setReportOpen(true); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-forest hover:bg-mint/60"
          >
            <Flag className="h-4 w-4" aria-hidden="true" /> Report
          </button>
          <button
            type="button"
            onClick={() => { closeMenu(); setBlockOpen(true); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-danger-ink hover:bg-danger-soft"
          >
            <Ban className="h-4 w-4" aria-hidden="true" /> Block
          </button>
        </div>
      </details>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="profile"
        targetId={person.id}
        targetName={person.username ? `@${person.username}` : person.full_name}
      />

      <ConfirmDialog
        open={blockOpen}
        title={`Block ${person.full_name}?`}
        text="They will disappear from your Discover, chats and groups. Any connection between you will be removed."
        confirmLabel="Block"
        danger
        loading={blockBusy}
        onConfirm={() => void confirmBlock()}
        onClose={() => setBlockOpen(false)}
      />
    </div>
  );
}
