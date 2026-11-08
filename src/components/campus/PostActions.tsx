import { useRef, useState } from 'react';
import { Ban, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { blockUser } from '@/lib/api/blocks';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import type { ReportTarget } from '@/types/db';

interface Props {
  targetType: ReportTarget;
  targetId: string;
  targetName?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  onDelete?: () => void | Promise<void>;
  onChanged?: () => void;
}

export function PostActions({ targetType, targetId, targetName, authorId, authorName, onDelete, onChanged }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const close = () => { if (menuRef.current) menuRef.current.open = false; };

  const confirmBlock = async () => {
    if (!authorId) return;
    setBlockBusy(true);
    try {
      await blockUser(authorId);
      setBlockOpen(false);
      toast.success('Person blocked.');
      onChanged?.();
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setBlockBusy(false); }
  };

  return (
    <>
      <details ref={menuRef} className="relative">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-xl text-muted hover:bg-mint/60 [&::-webkit-details-marker]:hidden" aria-label="Post actions">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </summary>
        <div className="app-pop-menu absolute right-0 z-30 mt-1 w-40 rounded-2xl border border-line bg-surface p-1 shadow-xl">
          <button type="button" onClick={() => { close(); setReportOpen(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-forest hover:bg-mint/60"><Flag className="h-4 w-4" aria-hidden="true" /> Report</button>
          {authorId && <button type="button" onClick={() => { close(); setBlockOpen(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-danger-ink hover:bg-danger-soft"><Ban className="h-4 w-4" aria-hidden="true" /> Block author</button>}
          {onDelete && <button type="button" onClick={() => { close(); void onDelete(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-danger-ink hover:bg-danger-soft"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</button>}
        </div>
      </details>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType={targetType} targetId={targetId} targetName={targetName} />
      <ConfirmDialog open={blockOpen} title={`Block ${authorName ?? 'this person'}?`} text="They will disappear from your feeds, chats and groups. Any connection between you will be removed." confirmLabel="Block" danger loading={blockBusy} onConfirm={() => void confirmBlock()} onClose={() => setBlockOpen(false)} />
    </>
  );
}
