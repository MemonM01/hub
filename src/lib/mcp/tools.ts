import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { windowed } from './window'

// Every query below runs with the service role after the OAuth token was checked,
// so every one of them filters by user_id explicitly.

type Ctx = { userId: string; clientLabel: string }
type Args = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const num = (v: unknown, d: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : d
}

async function moduleIdFor(db: ReturnType<typeof createAdminClient>, userId: string, code?: string) {
  if (!code) return undefined
  const { data } = await db.from('modules').select('id').eq('user_id', userId).eq('code', code.toUpperCase().replace(/\s+/g, '')).maybeSingle()
  return data?.id ?? null
}

export const TOOLS = [
  {
    name: 'search',
    description: 'Search my files (titles, filenames, summaries and the text inside them) and my lecture titles and transcripts.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words to look for' }, limit: { type: 'number', description: 'Max results per kind, default 10' } },
      required: ['query'],
    },
  },
  { name: 'list_modules', description: 'List my modules with their codes and assignment progress.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'list_assignments',
    description: 'List my assignments (worksheets and quizzes) by module and sheet number, with status and due date. Cancelled ones are left out unless asked.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: 'Module code, e.g. COMP2850' },
        status: { type: 'string', enum: ['not_started', 'in_progress', 'submitted', 'graded', 'cancelled'] },
      },
    },
  },
  {
    name: 'list_lectures',
    description: 'List my Panopto lectures, newest first, with watched state.',
    inputSchema: {
      type: 'object',
      properties: { module: { type: 'string' }, unwatched: { type: 'boolean' }, limit: { type: 'number' } },
    },
  },
  {
    name: 'list_timetable',
    description: 'List my own timetable sessions between two dates (default: today and the next 7 days). Times are Europe/London.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD, exclusive' },
        module: { type: 'string' },
      },
    },
  },
  {
    name: 'get_lecture',
    description: 'Get one lecture. The transcript comes back as windows around the query, not the whole thing.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, query: { type: 'string', description: 'What to find in the transcript' } },
      required: ['id'],
    },
  },
  {
    name: 'get_file',
    description: 'Get one file with its summary. Its extracted text comes back as windows around the query, not the whole thing.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, query: { type: 'string', description: 'What to find in the text' } },
      required: ['id'],
    },
  },
  { name: 'get_learning_profile', description: 'Read my learning profile: how I learn, what I find hard, what I am working on.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'update_learning_profile',
    description: 'Replace my learning profile with new text. Each change is logged in my Activity page with the old text, so I can undo it.',
    inputSchema: {
      type: 'object',
      properties: { content: { type: 'string', description: 'The full new profile (Markdown)' }, reason: { type: 'string', description: 'One line on what changed and why' } },
      required: ['content'],
    },
  },
] as const

export async function callTool(name: string, args: Args, ctx: Ctx): Promise<unknown> {
  const db = createAdminClient()
  const { userId } = ctx

  switch (name) {
    case 'search': {
      const q = str(args.query)
      if (!q) throw new Error('query is required')
      const limit = num(args.limit, 10, 25)
      const [files, lectures] = await Promise.all([
        db
          .from('files')
          .select('id, filename, title, kind, week, summary, modules(code)')
          .eq('user_id', userId)
          .not('size_bytes', 'is', null)
          .textSearch('search', q, { type: 'websearch', config: 'english' })
          .limit(limit),
        db
          .from('lectures')
          .select('id, title, delivered_at, modules(code)')
          .eq('user_id', userId)
          .textSearch('search', q, { type: 'websearch', config: 'english' })
          .limit(limit),
      ])
      return {
        files: (files.data ?? []).map((f) => ({ ...f, module: (f.modules as unknown as { code: string } | null)?.code ?? null, modules: undefined })),
        lectures: (lectures.data ?? []).map((l) => ({ ...l, module: (l.modules as unknown as { code: string } | null)?.code ?? null, modules: undefined })),
        hint: 'Use get_file or get_lecture with an id and the same query to read the matching parts.',
      }
    }
    case 'list_modules': {
      const [{ data: mods }, { data: as }] = await Promise.all([
        db.from('modules').select('id, code, name, archived').eq('user_id', userId).order('code'),
        db.from('assignments').select('module_id, status').eq('user_id', userId),
      ])
      return (mods ?? []).map((m) => {
        const live = (as ?? []).filter((a) => a.module_id === m.id && a.status !== 'cancelled')
        return { code: m.code, name: m.name, archived: m.archived, assignments: live.length, done: live.filter((a) => ['submitted', 'graded'].includes(a.status)).length }
      })
    }
    case 'list_assignments': {
      let q = db.from('assignments').select('id, sheet, title, is_quiz, status, due_at, modules(code)').eq('user_id', userId)
      const mid = await moduleIdFor(db, userId, str(args.module))
      if (mid === null) return []
      if (mid) q = q.eq('module_id', mid)
      const status = str(args.status)
      q = status ? q.eq('status', status) : q.neq('status', 'cancelled')
      const { data } = await q
      return (data ?? [])
        .map((a) => ({ id: a.id, module: (a.modules as unknown as { code: string } | null)?.code, sheet: a.sheet, title: a.title, quiz: a.is_quiz, status: a.status, due_at: a.due_at }))
        .sort((a, b) => String(a.module).localeCompare(String(b.module)) || a.sheet.localeCompare(b.sheet, 'en', { numeric: true }))
    }
    case 'list_lectures': {
      let q = db
        .from('lectures')
        .select('id, title, delivered_at, duration_seconds, transcript, modules(code), lecture_progress(watched, percent)')
        .eq('user_id', userId)
        .order('delivered_at', { ascending: false })
        .limit(num(args.limit, 50, 200))
      const mid = await moduleIdFor(db, userId, str(args.module))
      if (mid === null) return []
      if (mid) q = q.eq('module_id', mid)
      const { data } = await q
      return (data ?? [])
        .map((l) => {
          const p = l.lecture_progress as unknown as { watched: boolean; percent: number } | null
          return {
            id: l.id,
            title: l.title,
            module: (l.modules as unknown as { code: string } | null)?.code ?? null,
            delivered_at: l.delivered_at,
            minutes: l.duration_seconds ? Math.round(l.duration_seconds / 60) : null,
            watched: !!p?.watched,
            has_transcript: !!l.transcript,
          }
        })
        .filter((l) => !args.unwatched || !l.watched)
    }
    case 'list_timetable': {
      const from = str(args.from) ?? new Date().toISOString().slice(0, 10)
      const to = str(args.to) ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
      let q = db
        .from('timetable_sessions')
        .select('module_code, module_name, activity_type, staff, location, summary, starts_at, ends_at')
        .eq('user_id', userId) // my sessions only
        .gte('starts_at', `${from}T00:00:00Z`)
        .lt('starts_at', `${to}T00:00:00Z`)
        .order('starts_at')
        .limit(300)
      const code = str(args.module)
      if (code) q = q.eq('module_code', code.toUpperCase())
      const { data } = await q
      return data ?? []
    }
    case 'get_lecture': {
      const id = str(args.id)
      if (!id) throw new Error('id is required')
      const { data: l } = await db
        .from('lectures')
        .select('id, title, delivered_at, duration_seconds, viewer_url, transcript, modules(code), lecture_progress(watched, percent)')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (!l) throw new Error('No lecture with that id.')
      const { transcript, modules, lecture_progress, ...rest } = l
      return {
        ...rest,
        module: (modules as unknown as { code: string } | null)?.code ?? null,
        progress: lecture_progress,
        transcript: windowed(transcript, str(args.query)),
      }
    }
    case 'get_file': {
      const id = str(args.id)
      if (!id) throw new Error('id is required')
      const { data: f } = await db
        .from('files')
        .select('id, filename, title, kind, week, summary, size_bytes, extracted_text, created_at, modules(code), assignments(sheet)')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (!f) throw new Error('No file with that id.')
      if (f.size_bytes == null) return { id: f.id, filename: f.filename, note: 'Only the name is stored. The file itself never arrived.' }
      const { extracted_text, modules, assignments, ...rest } = f
      return {
        ...rest,
        module: (modules as unknown as { code: string } | null)?.code ?? null,
        sheet: (assignments as unknown as { sheet: string } | null)?.sheet ?? null,
        text: windowed(extracted_text, str(args.query)),
      }
    }
    case 'get_learning_profile': {
      const { data } = await db.from('learning_profiles').select('content, updated_at').eq('user_id', userId).maybeSingle()
      return data ?? { content: '', updated_at: null, note: 'No profile yet.' }
    }
    case 'update_learning_profile': {
      const content = typeof args.content === 'string' ? args.content.slice(0, 50_000) : null
      if (content == null) throw new Error('content is required')
      const { data: before } = await db.from('learning_profiles').select('content').eq('user_id', userId).maybeSingle()
      const { error } = await db.from('learning_profiles').upsert({ user_id: userId, content })
      if (error) throw new Error(error.message)
      await db.from('activity').insert({
        user_id: userId,
        actor: ctx.clientLabel,
        entity: 'learning_profile',
        entity_id: userId,
        action: str(args.reason)?.slice(0, 300) ?? 'Updated learning profile',
        before: { content: before?.content ?? '' },
        after: { content },
      })
      return { ok: true, chars: content.length }
    }
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}
