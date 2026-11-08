import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { ReportReason, ReportTarget } from '@/types/db';

export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
}

export async function submitReport({ targetType, targetId, reason, details }: ReportInput): Promise<void> {
  const res = await supabase.from('reports').insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details?.trim() ? details.trim() : null,
  });
  unwrap(res as { data: unknown; error: unknown });
}
