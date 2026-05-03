import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY in .env')
}

// admin client — bypasses RLS, for backend DB ops and verifying tokens
export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// public client — used for user-facing auth like signInWithPassword
export const supabasePublic = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
