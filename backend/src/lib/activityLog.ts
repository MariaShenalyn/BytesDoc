import { supabase } from '../config/supabase'
import { ActivityLog } from '../types'

interface LogParams {
  userId: string
  action: ActivityLog['action']
  documentId?: string
}

// Fire-and-forget: never throws, never blocks the request path.
// If the log write fails, the user's action still succeeds.
export function logActivity({ userId, action, documentId }: LogParams): void {
  supabase
    .from('activity_logs')
    .insert({ user_id: userId, action, document_id: documentId ?? null })
    .then(({ error }) => {
      if (error) console.error('activity log insert failed:', error.message)
    })
}
