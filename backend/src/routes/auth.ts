import { Router } from 'express'
import { supabase, supabasePublic } from '../config/supabase'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { Role } from '../types'

const router = Router()

interface ProfileRow {
  id: string
  email: string
  name: string
  role: { role_name: Role }
  created_at: string
}

function toUser(p: ProfileRow) {
  return {
    id: p.id,
    email: p.email,
    fullName: p.name,
    role: p.role.role_name,
    createdAt: p.created_at,
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: 'invalid email or password' })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('id, email, name, role:roles(role_name), created_at')
      .eq('id', data.user.id)
      .single<ProfileRow>()

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'user profile not found' })
    }

    supabase
      .from('activity_logs')
      .insert({ user_id: profile.id, action: 'login' })
      .then(({ error: logErr }) => {
        if (logErr) console.error('activity log insert failed:', logErr.message)
      })

    res.json({
      user: toUser(profile),
      token: data.session.access_token,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', requireAuth, (_req, res) => {
  // JWTs are stateless — frontend drops the token on its side.
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role:roles(role_name), created_at')
      .eq('id', req.user!.id)
      .single<ProfileRow>()

    if (error || !data) {
      return res.status(404).json({ error: 'user not found' })
    }
    res.json(toUser(data))
  } catch (err) {
    next(err)
  }
})

export default router
