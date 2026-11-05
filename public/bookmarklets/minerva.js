/* hub · Minerva bookmarklet
 * Runs on https://minerva.leeds.ac.uk while I am logged in. Lists the files in my modules with my own
 * session cookie and records them in hub by an external id, so a later run skips anything stored.
 * Loaded fresh on every click.
 */
;(function () {
  'use strict'

  var cfg = window.__hub || {}
  var HUB = String(cfg.origin || '').replace(/\/$/, '')
  var TOKEN = String(cfg.token || '')
  var API = location.origin + '/learn/api/public/v1'
  var MAX_DOWNLOADS = 80

  // ---------- overlay ----------
  var box = document.getElementById('hub-sync-box')
  if (box) box.remove()
  box = document.createElement('div')
  box.id = 'hub-sync-box'
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;width:360px;max-height:70vh;overflow:auto;' +
    'background:#141513;color:#ecebe6;font:12px/1.45 system-ui,sans-serif;border-radius:10px;padding:12px 14px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,.35)'
  box.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:13px">hub · Minerva sync</b>' +
    '<button id="hub-sync-x" style="margin-left:auto;background:none;border:0;color:#9a9c94;cursor:pointer;font-size:14px">×</button></div>' +
    '<div id="hub-sync-log"></div>'
  document.body.appendChild(box)
  document.getElementById('hub-sync-x').onclick = function () {
    box.remove()
  }
  var logEl = document.getElementById('hub-sync-log')
  function log(msg, tone) {
    var p = document.createElement('div')
    p.textContent = msg
    if (tone === 'bad') p.style.color = '#f2827a'
    if (tone === 'good') p.style.color = '#6fb7ad'
    if (tone === 'dim') p.style.color = '#9a9c94'
    logEl.appendChild(p)
    box.scrollTop = box.scrollHeight
    return p
  }

  if (!HUB || !TOKEN) return log('This bookmark is missing its token. Make a new one in hub Settings.', 'bad')
  if (location.origin !== 'https://minerva.leeds.ac.uk') {
    return log('Open minerva.leeds.ac.uk first, log in, then click this again.', 'bad')
  }

  // ---------- helpers ----------
  function LoginError() {
    this.message = 'Minerva returned a login page. Log in to Minerva in this tab, then click again.'
  }

  function bb(path) {
    return fetch(API + path, { credentials: 'include', headers: { accept: 'application/json' } }).then(function (res) {
      return res.text().then(function (text) {
        var t = text.trim()
        if (res.status === 401 || (res.redirected && /login|auth|sso/i.test(res.url))) throw new LoginError()
        if (t.charAt(0) === '<') {
          if (/login|sign in/i.test(t.slice(0, 4000))) throw new LoginError()
          throw new Error('HTML from ' + path.split('?')[0] + ' (' + res.status + ')')
        }
        if (!res.ok) {
          var e = new Error('Minerva ' + res.status + ' from ' + path.split('?')[0])
          e.status = res.status
          throw e
        }
        return t ? JSON.parse(t) : {}
      })
    })
  }

  // Follow Blackboard paging.
  function bbAll(path) {
    var out = []
    function next(p) {
      return bb(p).then(function (data) {
        out = out.concat(data.results || [])
        var np = data.paging && data.paging.nextPage
        if (np && out.length < 2000) return next(np.replace(/^\/learn\/api\/public\/v1/, ''))
        return out
      })
    }
    return next(path)
  }

  function hub(path, body) {
    return fetch(HUB + path, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data && data.error ? data.error : 'hub ' + res.status)
        return data
      })
    })
  }

  function codeIn(text, codes) {
    var up = String(text || '').toUpperCase().replace(/[\s_-]+/g, '')
    for (var i = 0; i < codes.length; i++) if (new RegExp(codes[i] + '(?!\\d)').test(up)) return codes[i]
    return null
  }

  function weekOf(titles) {
    for (var i = titles.length - 1; i >= 0; i--) {
      var m = /(?:^|[^A-Za-z])(?:week|wk)\s*(\d{1,2})(?!\d)/i.exec(titles[i])
      if (m) return Number(m[1])
    }
    return null
  }

  function pool(items, n, fn) {
    var i = 0
    function worker() {
      if (i >= items.length) return Promise.resolve()
      var item = items[i++]
      return Promise.resolve(fn(item)).then(worker, worker)
    }
    var ws = []
    for (var k = 0; k < n; k++) ws.push(worker())
    return Promise.all(ws)
  }

  // ---------- courses ----------
  function myCourses(codes) {
    return bb('/users/me').then(function (me) {
      return bbAll('/users/' + me.id + '/courses?limit=100&expand=course').then(function (rows) {
        // The newest course per module code is this year's.
        var best = {}
        rows.forEach(function (r) {
          var c = r.course || {}
          var code = codeIn((c.courseId || '') + ' ' + (c.name || '') + ' ' + (c.externalId || ''), codes)
          if (!code) return
          if (!best[code] || String(c.created || '') > String(best[code].created || '')) {
            best[code] = { id: c.id || r.courseId, name: c.name || c.courseId, created: c.created, code: code }
          }
        })
        return Object.keys(best).map(function (k) {
          return best[k]
        })
      })
    })
  }

  // ---------- content tree ----------
  function walk(course, complete) {
    var files = []
    var visited = 0
    function list(path, trail, depth) {
      if (depth > 8 || visited > 1500) return Promise.resolve()
      return bbAll(path).then(
        function (items) {
          return items.reduce(function (p, item) {
            return p.then(function () {
              visited++
              var handler = (item.contentHandler && item.contentHandler.id) || ''
              var titles = trail.concat([item.title || ''])
              var tasks = []
              if (item.hasChildren || /folder|lesson|module/i.test(handler)) {
                tasks.push(list('/courses/' + course.id + '/contents/' + item.id + '/children?limit=200', titles, depth + 1))
              }
              if (/file|document|assignment/i.test(handler)) {
                tasks.push(
                  bb('/courses/' + course.id + '/contents/' + item.id + '/attachments').then(
                    function (data) {
                      ;(data.results || []).forEach(function (a) {
                        if (!a.fileName) return
                        var ext = 'minerva:' + course.id + ':' + item.id + ':' + a.id
                        files.push({
                          externalId: ext,
                          moduleCode: course.code,
                          filename: a.fileName,
                          title: item.title && item.title !== a.fileName ? item.title : null,
                          week: weekOf(titles),
                          _download: API + '/courses/' + course.id + '/contents/' + item.id + '/attachments/' + a.id + '/download',
                          _done: !!complete[ext],
                        })
                      })
                    },
                    function (e) {
                      if (e instanceof LoginError) throw e
                    },
                  ),
                )
              }
              return Promise.all(tasks)
            })
          }, Promise.resolve())
        },
        function (e) {
          if (e instanceof LoginError) throw e
          // A folder I cannot open: skip it, keep going.
        },
      )
    }
    return list('/courses/' + course.id + '/contents?limit=200', [], 0).then(function () {
      return files
    })
  }

  // ---------- bytes ----------
  function getBytes(url) {
    return fetch(url, { credentials: 'include' }).then(function (res) {
      if (!res.ok) throw new Error('download ' + res.status)
      var type = res.headers.get('content-type') || ''
      if (/text\/html/i.test(type) && !/\.html?$/i.test(url)) throw new Error('got a web page, not the file')
      return res.blob()
    })
  }

  // First a signed PUT straight to R2. From the Minerva origin that is normally refused by R2's CORS
  // (it only allows hub's own origins), so small files fall back to the hub relay.
  function store(need, blob, relayMax) {
    return fetch(need.putUrl, { method: 'PUT', headers: { 'content-type': need.contentType }, body: blob })
      .then(function (res) {
        if (!res.ok) throw new Error('put ' + res.status)
        return hub('/api/sync/minerva/done', { fileId: need.fileId }).then(function () {
          return 'stored'
        })
      })
      .catch(function () {
        if (blob.size > relayMax) return 'too-big'
        return fetch(HUB + '/api/sync/minerva/bytes?fileId=' + encodeURIComponent(need.fileId), {
          method: 'POST',
          headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/octet-stream' },
          body: blob,
        }).then(function (res) {
          return res.ok ? 'stored' : 'failed'
        })
      })
  }

  // ---------- run ----------
  var totals = { recorded: 0, stored: 0, nameOnly: 0, failed: 0, skipped: 0 }
  log('Asking hub for your modules…', 'dim')
  hub('/api/sync/minerva/config')
    .then(function (state) {
      var codes = state.moduleCodes || []
      if (!codes.length) throw new Error('Add your modules in hub first.')
      var complete = {}
      ;(state.complete || []).forEach(function (id) {
        complete[id] = 1
      })
      log('Modules: ' + codes.join(', '))
      return myCourses(codes).then(function (courses) {
        if (!courses.length) throw new Error('None of your Minerva courses match ' + codes.join(', ') + '.')
        return courses.reduce(function (p, course) {
          return p.then(function () {
            var line = log(course.code + ': reading ' + course.name + '…', 'dim')
            return walk(course, complete).then(function (files) {
              var fresh = files.filter(function (f) {
                return !f._done
              })
              totals.skipped += files.length - fresh.length
              line.textContent = course.code + ': ' + files.length + ' file(s), ' + fresh.length + ' new or missing bytes'
              if (!fresh.length) return
              var byExt = {}
              fresh.forEach(function (f) {
                byExt[f.externalId] = f
              })
              var batches = []
              for (var i = 0; i < fresh.length; i += 100) batches.push(fresh.slice(i, i + 100))
              return batches.reduce(function (q, batch) {
                return q.then(function () {
                  var payload = batch.map(function (f) {
                    return { externalId: f.externalId, moduleCode: f.moduleCode, filename: f.filename, title: f.title, week: f.week }
                  })
                  return hub('/api/sync/minerva/files', { files: payload }).then(function (r) {
                    totals.recorded += r.recorded || 0
                    var needs = (r.needBytes || []).slice(0, Math.max(0, MAX_DOWNLOADS - totals.stored - totals.nameOnly - totals.failed))
                    return pool(needs, 3, function (need) {
                      var f = byExt[need.externalId]
                      if (!f) return
                      return getBytes(f._download)
                        .then(function (blob) {
                          return store(need, blob, state.relayMaxBytes || 0)
                        })
                        .then(
                          function (result) {
                            if (result === 'stored') totals.stored++
                            else if (result === 'too-big') totals.nameOnly++
                            else totals.failed++
                          },
                          function () {
                            totals.failed++
                          },
                        )
                    })
                  })
                })
              }, Promise.resolve())
            })
          })
        }, Promise.resolve())
      })
    })
    .then(function () {
      log(
        'Done. ' + totals.stored + ' file(s) stored, ' + totals.nameOnly + ' too big to copy (name only), ' +
          totals.failed + ' failed, ' + totals.skipped + ' already in hub.',
        'good',
      )
      if (totals.nameOnly + totals.failed > 0)
        log('Names without a file show on hub Files under "Names without a file". Drop the real download there.', 'dim')
    })
    .catch(function (e) {
      log(e && e.message ? e.message : String(e), 'bad')
    })
})()
