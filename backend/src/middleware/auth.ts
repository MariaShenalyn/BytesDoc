import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import { Role } from '../types'

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; role: Role }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }
  const token = header.slice('Bearer '.length)

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('id, email, role:roles(role_name)')
    .eq('id', data.user.id)
    .single<{ id: string; email: string; role: { role_name: Role } }>()

  if (profileErr || !profile) {
    return res.status(403).json({ error: 'User profile not found' })
  }

  req.user = { id: profile.id, email: profile.email, role: profile.role.role_name }
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
