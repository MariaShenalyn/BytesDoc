import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../config/supabase'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { logActivity } from '../lib/activityLog'
import { uploadFile, createSignedUrl, deleteFile, buildKey } from '../lib/storage'
import { Document, Role } from '../types'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const CATEGORIES = ['Proposals', 'Permits', 'Budgets', 'Reports', 'Financial Records'] as const
const FILE_TYPES = ['pdf', 'docx'] as const

const FINANCE_CATEGORIES = new Set<Document['category']>(['Budgets', 'Financial Records'])
const FINANCE_VISIBLE = new Set<Document['category']>(['Budgets', 'Financial Records', 'Reports'])

interface DocumentRow {
  id: string
  title: string
  category: Document['category']
  event: string
  administration: string
  uploaded_by: string
  upload_date: string
  file_path: string
  is_archived: boolean
  is_locked: boolean
  file_type: Document['fileType']
}

function toDocument(r: DocumentRow): Document {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    event: r.event,
    administration: r.administration,
    uploadedBy: r.uploaded_by,
    uploadDate: r.upload_date,
    filePath: r.file_path,
    is_archived: r.is_archived,
    is_locked: r.is_locked,
    fileType: r.file_type,
  }
}

function categoryAllowedForRole(role: Role, category: Document['category']): boolean {
  if (role === 'chief_minister' || role === 'member') return true
  if (role === 'secretary') return !FINANCE_CATEGORIES.has(category)
  if (role === 'finance_minister') return FINANCE_VISIBLE.has(category)
  return false
}

function canUploadCategory(role: Role, category: Document['category']): boolean {
  if (role === 'chief_minister') return true
  if (role === 'secretary') return !FINANCE_CATEGORIES.has(category)
  if (role === 'finance_minister') return FINANCE_VISIBLE.has(category)
  return false
}

router.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { category, administration, archived, q } = req.query
    let query = supabase.from('documents').select('*').order('upload_date', { ascending: false })

    if (typeof category === 'string') query = query.eq('category', category)
    if (typeof administration === 'string') query = query.eq('administration', administration)
    if (archived === 'true') query = query.eq('is_archived', true)
    else if (archived === 'false') query = query.eq('is_archived', false)
    if (typeof q === 'string' && q.trim()) query = query.ilike('title', `%${q.trim()}%`)

    const { data, error } = await query.returns<DocumentRow[]>()
    if (error) return res.status(500).json({ error: error.message })

    const role = req.user!.role
    const filtered = data.filter((row) => categoryAllowedForRole(role, row.category))
    res.json(filtered.map(toDocument))
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single<DocumentRow>()

    if (error || !data) return res.status(404).json({ error: 'document not found' })
    if (!categoryAllowedForRole(req.user!.role, data.category)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    logActivity({ userId: req.user!.id, action: 'view', documentId: data.id })
    res.json(toDocument(data))
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res, next) => {
  try {
    const role = req.user!.role
    if (role === 'member') return res.status(403).json({ error: 'members cannot upload' })

    if (!req.file) return res.status(400).json({ error: 'file is required' })

    const { title, category, event, administration, fileType } = req.body ?? {}
    if (!title || !category || !event || !administration || !fileType) {
      return res
        .status(400)
        .json({ error: 'title, category, event, administration, fileType are required' })
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}` })
    }
    if (!FILE_TYPES.includes(fileType)) {
      return res.status(400).json({ error: `fileType must be one of ${FILE_TYPES.join(', ')}` })
    }
    if (!canUploadCategory(role, category)) {
      return res.status(403).json({ error: `your role cannot upload ${category}` })
    }

    // Phase 1: insert row to get an id, with a placeholder file_path.
    const { data: created, error: insertErr } = await supabase
      .from('documents')
      .insert({
        title,
        category,
        event,
        administration,
        uploaded_by: req.user!.id,
        file_path: 'pending',
        file_type: fileType,
      })
      .select('*')
      .single<DocumentRow>()

    if (insertErr || !created) {
      return res.status(500).json({ error: insertErr?.message ?? 'insert failed' })
    }

    const key = buildKey(created.id, req.file.originalname)

    // Phase 2: upload file. If it fails, roll back the row.
    try {
      await uploadFile(key, req.file.buffer, req.file.mimetype)
    } catch (e) {
      await supabase.from('documents').delete().eq('id', created.id)
      throw e
    }

    // Phase 3: patch the row with the real key.
    const { data: updated, error: updateErr } = await supabase
      .from('documents')
      .update({ file_path: key })
      .eq('id', created.id)
      .select('*')
      .single<DocumentRow>()

    if (updateErr || !updated) {
      await deleteFile(key).catch(() => {})
      await supabase.from('documents').delete().eq('id', created.id)
      return res.status(500).json({ error: updateErr?.message ?? 'update failed' })
    }

    logActivity({ userId: req.user!.id, action: 'upload', documentId: updated.id })
    res.status(201).json(toDocument(updated))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data: existing, error: getErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single<DocumentRow>()

    if (getErr || !existing) return res.status(404).json({ error: 'document not found' })

    const isOwner = existing.uploaded_by === req.user!.id
    const isAdmin = req.user!.role === 'chief_minister'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' })

    if (existing.is_archived || existing.is_locked) {
      return res.status(409).json({ error: 'cannot edit archived or locked document' })
    }

    const { title, category, event, administration } = req.body ?? {}
    const patch: Partial<DocumentRow> = {}
    if (typeof title === 'string') patch.title = title
    if (typeof event === 'string') patch.event = event
    if (typeof administration === 'string') patch.administration = administration
    if (typeof category === 'string') {
      if (!CATEGORIES.includes(category as Document['category'])) {
        return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}` })
      }
      patch.category = category as Document['category']
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no editable fields provided' })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single<DocumentRow>()

    if (updateErr || !updated) {
      return res.status(500).json({ error: updateErr?.message ?? 'update failed' })
    }
    res.json(toDocument(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data: existing, error: getErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single<DocumentRow>()

    if (getErr || !existing) return res.status(404).json({ error: 'document not found' })

    const isOwner = existing.uploaded_by === req.user!.id
    const isAdmin = req.user!.role === 'chief_minister'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' })

    if (existing.is_archived) {
      return res.status(409).json({ error: 'cannot delete archived document' })
    }

    await deleteFile(existing.file_path).catch((e) => {
      console.error('storage delete failed (continuing with row delete):', e.message)
    })

    const { error: delErr } = await supabase.from('documents').delete().eq('id', req.params.id)
    if (delErr) return res.status(500).json({ error: delErr.message })

    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

router.get('/:id/download', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single<DocumentRow>()

    if (error || !data) return res.status(404).json({ error: 'document not found' })
    if (!categoryAllowedForRole(req.user!.role, data.category)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const url = await createSignedUrl(data.file_path, 60)
    logActivity({ userId: req.user!.id, action: 'download', documentId: data.id })
    res.json({ url, expiresInSec: 60 })
  } catch (err) {
    next(err)
  }
})

export default router
