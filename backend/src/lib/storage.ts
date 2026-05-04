import { supabase } from '../config/supabase'

const BUCKET = 'documents'

export async function uploadFile(key: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(`storage upload failed: ${error.message}`)
}

export async function createSignedUrl(key: string, expiresInSec = 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, expiresInSec)
  if (error || !data) throw new Error(`signed url failed: ${error?.message ?? 'unknown'}`)
  return data.signedUrl
}

export async function deleteFile(key: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([key])
  if (error) throw new Error(`storage delete failed: ${error.message}`)
}

export function buildKey(docId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${docId}/${safe}`
}
