import { supabase } from '../supabase';
import { unwrap } from '../errors';
import type { AdminReport, ConfessionFeedRow } from '@/types/db';

export async function listReports(status: 'open' | 'reviewing' | 'actioned' | 'dismissed' | 'all' = 'open'): Promise<AdminReport[]> {
  const res = await supabase.rpc('admin_list_reports', { p_status: status });
  return unwrap<AdminReport[]>(res) ?? [];
}

export async function resolveReport(id: string, action: 'reviewing' | 'actioned' | 'dismissed'): Promise<void> {
  const res = await supabase.rpc('admin_resolve_report', { p_report: id, p_status: action });
  unwrap(res as { data: unknown; error: unknown });
}

export async function listPendingConfessions(): Promise<ConfessionFeedRow[]> {
  const res = await supabase.rpc('admin_list_pending_confessions');
  return unwrap<ConfessionFeedRow[]>(res) ?? [];
}

export async function reviewConfession(id: string, approve: boolean): Promise<void> {
  const res = await supabase.rpc('admin_review_confession', { p_confession: id, p_approve: approve });
  unwrap(res as { data: unknown; error: unknown });
}
