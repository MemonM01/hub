/* hub sync extension: Minerva files.
 * Runs in the extension, which may read from Minerva's file server (alt-….leeds.ac.uk) with my own
 * cookies and PUT straight to R2. A page bookmarklet cannot do either. My password is never seen here.
 */

const MINERVA = 'https://minerva.leeds.ac.uk'
const API = MINERVA + '/learn/api/public/v1'
const MAX_DOWNLOADS = 300

// ---------- progress, shown in the popup ----------
let status = { running: false, lines: [] }
function save() {
  return chrome.storage.session.set({ status })
}
function log(msg, tone) {
  status.lines.push({ msg, tone })
  if (status.lines.length > 200) status.lines.shift()
  save()
  return status.lines.length - 1
}
function relog(i, msg, tone) {
  status.lines[i] = { msg, tone }
  save()
}

class LoginError extends Error {
  constructor() {
    super('Minerva sent a login page. Open minerva.leeds.ac.uk, log in, then sync again.')
  }
}

// ---------- Minerva ----------
async function bb(path) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
  const text = (await res.text()).trim()
  if (res.status === 401 || (res.redirected && /login|auth|sso/i.test(res.url))) throw new LoginError()
  if (text.startsWith('<')) {
    if (/login|sign in/i.test(text.slice(0, 4000))) throw new LoginError()
    throw new Error('HTML from ' + path.split('?')[0] + ' (' + res.status + ')')
  }
  if (!res.ok) throw new Error('Minerva ' + res.status + ' from ' + path.split('?')[0])
  return text ? JSON.parse(text) : {}
}

async function bbAll(path) {
  let out = []
  let next = path
  while (next && out.length < 2000) {
    const data = await bb(next)
    out = out.concat(data.results || [])
    const np = data.paging && data.paging.nextPage
    next = np ? np.replace(/^\/learn\/api\/public\/v1/, '') : null
  }
  return out
}

function codeIn(text, codes) {
  const up = String(text || '').toUpperCase().replace(/[\s_-]+/g, '')
  return codes.find((c) => new RegExp(c + '(?!\\d)').test(up)) || null
}

function weekOf(titles) {
  for (let i = titles.length - 1; i >= 0; i--) {
    const m = /(?:^|[^A-Za-z])(?:week|wk)\s*(\d{1,2})(?!\d)/i.exec(titles[i])
    if (m) return Number(m[1])
  }
  return null
}

async function myCourses(codes) {
  const me = await bb('/users/me')
  const rows = await bbAll('/users/' + me.id + '/courses?limit=100&expand=course')
  const best = {}
  for (const r of rows) {
    const c = r.course || {}
    const code = codeIn((c.courseId || '') + ' ' + (c.name || '') + ' ' + (c.externalId || ''), codes)
    if (!code) continue
    // The newest course per module code is this year's.
    if (!best[code] || String(c.created || '') > String(best[code].created || '')) {
      best[code] = { id: c.id || r.courseId, name: c.name || c.courseId, created: c.created, code }
    }
  }
  return Object.values(best)
}

async function walk(course, complete) {
  const files = []
  let visited = 0
  async function list(path, trail, depth) {
    if (depth > 8 || visited > 1500) return
    let items
    try {
      items = await bbAll(path)
    } catch (e) {
      if (e instanceof LoginError) throw e
      return // a folder I cannot open: skip it
    }
    for (const item of items) {
      visited++
      const handler = (item.contentHandler && item.contentHandler.id) || ''
      const titles = trail.concat([item.title || ''])
      if (item.hasChildren || /folder|lesson|module/i.test(handler)) {
        await list('/courses/' + course.id + '/contents/' + item.id + '/children?limit=200', titles, depth + 1)
      }
      if (/file|document|assignment/i.test(handler)) {
        let data
        try {
          data = await bb('/courses/' + course.id + '/contents/' + item.id + '/attachments')
        } catch (e) {
          if (e instanceof LoginError) throw e
          continue
        }
        for (const a of data.results || []) {
          if (!a.fileName) continue
          const ext = 'minerva:' + course.id + ':' + item.id + ':' + a.id
          files.push({
            externalId: ext,
            moduleCode: course.code,
            filename: a.fileName,
            title: item.title && item.title !== a.fileName ? item.title : null,
            week: weekOf(titles),
            download: API + '/courses/' + course.id + '/contents/' + item.id + '/attachments/' + a.id + '/download',
            done: !!complete[ext],
          })
        }
      }
    }
  }
  await list('/courses/' + course.id + '/contents?limit=200', [], 0)
  return files
}

async function getBytes(url) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('download ' + res.status + (res.url !== url ? ' via ' + new URL(res.url).host : ''))
  const blob = await res.blob()
  const head = (await blob.slice(0, 200).text()).trimStart().toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    if (/login|sso|auth/i.test(res.url)) throw new LoginError()
    throw new Error('got a web page, not the file')
  }
  return blob
}

// ---------- hub ----------
async function hub(cfg, path, body) {
  const res = await fetch(cfg.origin + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + cfg.token, 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    // not JSON
  }
  if (!res.ok) {
    const err = data.error
    const detail =
      typeof err === 'string' ? err : err ? err.message || err.code || JSON.stringify(err) : text.replace(/<[^>]*>/g, ' ').trim().slice(0, 160)
    throw new Error('hub ' + res.status + ' at ' + path + ': ' + (detail || 'no details'))
  }
  return data
}

// Straight to R2 with the signed PUT (the extension is allowed to), then hub checks the bytes.
async function store(cfg, need, blob) {
  const res = await fetch(need.putUrl, { method: 'PUT', headers: { 'content-type': need.contentType }, body: blob })
  if (!res.ok) throw new Error('storage ' + res.status)
  await hub(cfg, '/api/sync/minerva/done', { fileId: need.fileId })
}

async function pool(items, n, fn) {
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++]
      try {
        await fn(item)
      } catch {
        // counted inside fn
      }
    }
  }
  await Promise.all(Array.from({ length: n }, worker))
}

// ---------- run ----------
async function syncMinerva() {
  if (status.running) return
  status = { running: true, lines: [] }
  save()
  const cfg = await chrome.storage.local.get(['origin', 'token'])
  const totals = { stored: 0, failed: 0, skipped: 0 }
  const reasons = new Set()
  const fail = (e) => {
    totals.failed++
    const r = (e && e.message) || String(e)
    if (!reasons.has(r) && reasons.size < 4) log('Why: ' + r, 'bad')
    reasons.add(r)
  }
  try {
    if (!cfg.origin || !cfg.token) throw new Error('Save your hub address and sync token first.')
    log('Asking hub for your modules…', 'dim')
    const state = await hub(cfg, '/api/sync/minerva/config')
    const codes = state.moduleCodes || []
    if (!codes.length) throw new Error('Add your modules in hub first.')
    const complete = Object.fromEntries((state.complete || []).map((id) => [id, 1]))
    log('Modules: ' + codes.join(', '))

    const courses = await myCourses(codes)
    if (!courses.length) throw new Error('None of your Minerva courses match ' + codes.join(', ') + '.')

    for (const course of courses) {
      const line = log(course.code + ': reading ' + course.name + '…', 'dim')
      const files = await walk(course, complete)
      const fresh = files.filter((f) => !f.done)
      totals.skipped += files.length - fresh.length
      relog(line, course.code + ': ' + files.length + ' file(s), ' + fresh.length + ' to copy')
      const byExt = Object.fromEntries(fresh.map((f) => [f.externalId, f]))
      for (let i = 0; i < fresh.length; i += 100) {
        const batch = fresh.slice(i, i + 100).map(({ externalId, moduleCode, filename, title, week }) => ({
          externalId,
          moduleCode,
          filename,
          title,
          week,
        }))
        const r = await hub(cfg, '/api/sync/minerva/files', { files: batch })
        const room = Math.max(0, MAX_DOWNLOADS - totals.stored - totals.failed)
        const progress = log('Copying ' + Math.min(room, (r.needBytes || []).length) + ' file(s)…', 'dim')
        let n = 0
        await pool((r.needBytes || []).slice(0, room), 3, async (need) => {
          const f = byExt[need.externalId]
          if (!f) return
          try {
            await store(cfg, need, await getBytes(f.download))
            totals.stored++
          } catch (e) {
            fail(e)
          }
          relog(progress, 'Copied ' + ++n + ' of ' + Math.min(room, (r.needBytes || []).length) + '…', 'dim')
        })
      }
    }
    log(
      'Done. ' + totals.stored + ' file(s) copied, ' + totals.failed + ' failed, ' + totals.skipped + ' already in hub.',
      'good',
    )
  } catch (e) {
    log((e && e.message) || JSON.stringify(e), 'bad')
  } finally {
    status.running = false
    save()
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'sync-minerva') syncMinerva()
})
