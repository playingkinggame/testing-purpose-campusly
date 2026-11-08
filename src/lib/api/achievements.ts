import { supabase } from '../supabase';
import { AppError, unwrap } from '../errors';
import { requireUserId } from './auth';
import { compressImage, removeFile, signedUrl, uploadFile, validateFile } from './storage';
import { safeFileName } from '../utils';
import type { Achievement, AchievementKind } from '@/types/db';

export interface AchievementInput {
  kind: AchievementKind;
  title: string;
  description: string | null;
  issuer: string | null;
  achieved_on: string | null;
  file_path: string | null;
}

export async function listAchievements(userId: string): Promise<Achievement[]> {
  const res = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('achieved_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  return unwrap<Achievement[]>(res) ?? [];
}

export async function createAchievement(input: AchievementInput): Promise<Achievement> {
  const res = await supabase.from('achievements').insert(input).select('*').single();
  return unwrap<Achievement>(res);
}

export async function updateAchievement(id: string, input: AchievementInput): Promise<Achievement> {
  const res = await supabase.from('achievements').update(input).eq('id', id).select('*').single();
  return unwrap<Achievement>(res);
}

export async function deleteAchievement(id: string): Promise<void> {
  const me = await requireUserId();
  const existing = await supabase
    .from('achievements')
    .select('file_path')
    .eq('id', id)
    .eq('user_id', me)
    .maybeSingle();
  const row = unwrap<{ file_path: string | null } | null>(existing);
  const res = await supabase.from('achievements').delete().eq('id', id);
  unwrap(res as { data: unknown; error: unknown });
  if (row?.file_path) await removeFile('certificates', row.file_path);
}

/** Validates, shrinks images and uploads into certificates/<uid>/... . */
export async function uploadAchievementFile(userId: string, file: File): Promise<string> {
  const firstCheck = validateFile('certificates', file);
  if (firstCheck) throw new AppError(firstCheck);

  const isImage = file.type.startsWith('image/');
  const blob = isImage ? await compressImage(file, 1800, 0.86) : file;
  const type = (blob.type || file.type || 'application/octet-stream').split(';')[0];
  const secondCheck = validateFile('certificates', { size: blob.size, type });
  if (secondCheck) throw new AppError(secondCheck);

  const ext = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'achievement';
  const path = `${userId}/${safeFileName(`${base}.${ext}`)}`;
  return uploadFile('certificates', path, blob, type);
}

export async function achievementFileUrl(path: string): Promise<string> {
  return signedUrl('certificates', path);
}

export function isPdfPath(path?: string | null): boolean {
  return !!path && path.toLowerCase().endsWith('.pdf');
}
