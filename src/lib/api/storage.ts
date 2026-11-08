import { supabase } from '../supabase';
import { AppError, friendlyError } from '../errors';

export type Bucket = 'avatars' | 'certificates' | 'chat-files' | 'voice-notes' | 'notes' | 'campus-photos';

// Mirrors the limits written in phase1_database.sql (the database enforces them too).
const RULES: Record<Bucket, { maxBytes: number; mimes: string[]; label: string }> = {
  avatars: { maxBytes: 2 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'], label: 'a JPG, PNG or WebP image' },
  certificates: { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], label: 'an image or PDF' },
  'chat-files': {
    maxBytes: 20 * 1024 * 1024,
    mimes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    label: 'an image, PDF, document or zip',
  },
  'voice-notes': { maxBytes: 5 * 1024 * 1024, mimes: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'], label: 'an audio recording' },
  'campus-photos': { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'], label: 'a JPG, PNG or WebP image' },
  notes: {
    maxBytes: 10 * 1024 * 1024,
    mimes: [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    label: 'a PDF, image, text, Word or PowerPoint file',
  },
};

/** Returns a friendly message if the file is not allowed, otherwise null. */
export function validateFile(bucket: Bucket, file: { size: number; type: string }): string | null {
  const r = RULES[bucket];
  const mime = file.type.split(';')[0];
  if (!r.mimes.includes(mime)) return `This file type is not allowed. Please choose ${r.label}.`;
  if (file.size > r.maxBytes) return `File is too big. The limit is ${Math.round(r.maxBytes / 1024 / 1024)} MB.`;
  return null;
}

/** Shrinks a photo in the browser before upload (keeps avatars small and fast). */
export async function compressImage(file: File, maxSide = 640, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** avatars is a PUBLIC bucket, so a normal URL works. */
export function avatarUrl(path?: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Uploads and returns the storage path. */
export async function uploadFile(bucket: Bucket, path: string, body: Blob | File, contentType?: string): Promise<string> {
  const type = (contentType ?? body.type ?? 'application/octet-stream').split(';')[0];
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: type, upsert: false, cacheControl: '3600' });
  if (error) throw new AppError(friendlyError(error));
  return path;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]); // best effort
}

// Private buckets need signed links that expire. We cache them and refresh before they run out.
const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_SECONDS = 3600;

export async function signedUrl(bucket: Bucket, path: string, download?: string | boolean): Promise<string> {
  const key = `${bucket}/${path}/${download ?? ''}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt - Date.now() > 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS, download ? { download } : undefined);
  if (error || !data) throw new AppError('Could not open this file. It may have been removed, or you may not have access.');
  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export function forgetSignedUrl(bucket: Bucket, path: string): void {
  for (const k of cache.keys()) if (k.startsWith(`${bucket}/${path}/`)) cache.delete(k);
}
