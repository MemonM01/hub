/* hub · Panopto bookmarklet
 * Runs on https://leeds.cloud.panopto.eu while I am logged in. Reads my lectures with my own
 * session cookie and posts them to hub with my sync token. Loaded fresh on every click.
 */
;(function () {
  'use strict'

  var cfg = window.__hub || {}
  var HUB = String(cfg.origin || '').replace(/\/$/, '')
  var TOKEN = String(cfg.token || '')
  var BASE = location.origin + '/Panopto'
  var EMPTY = '00000000-0000-0000-0000-000000000000'
  var GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  // ---------- overlay ----------
  var box = document.getElementById('hub-sync-box')
  if (box) box.remove()
  box = document.createElement('div')
  box.id = 'hub-sync-box'
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;width:340px;max-height:70vh;overflow:auto;' +
    'background:#141513;color:#ecebe6;font:12px/1.45 system-ui,sans-serif;border-radius:10px;padding:12px 14px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,.35)'
  box.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:13px">hub · Panopto sync</b>' +
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
  }

  if (!HUB || !TOKEN) return log('This bookmark is missing its token. Make a new one in hub Settings.', 'bad')
  if (location.origin !== 'https://leeds.cloud.panopto.eu') {
    return log('Open leeds.cloud.panopto.eu first, log in, then click this again.', 'bad')
  }

  // ---------- helpers ----------
  function LoginError() {
    this.message = 'Panopto returned a login page. Log in to Panopto in this tab, then click again.'
  }

  // Never treat an HTML page as JSON. Only a real redirect to Panopto's sign-in page counts as
  // "logged out"; any other HTML (an error page, a 404) just means this call did not work.
  function looksLikeLogin(res, text) {
    if (res.redirected && /login|signin|auth/i.test(res.url)) return true
    return /<form[^>]+(login|signin)/i.test(text) || /id=["']?(loginControl|PageContentPlaceholder_loginControl)/i.test(text)
  }

  function readJson(path) {
    return function (res) {
      return res.text().then(function (text) {
        var type = res.headers.get('content-type') || ''
        var t = text.trim()
        if (t.charAt(0) === '<' || /text\/html/i.test(type)) {
          if (looksLikeLogin(res, t)) throw new LoginError()
          var html = new Error('HTML from ' + path.split('?')[0] + ' (' + res.status + ')')
          html.status = res.status + ' html'
          throw html
        }
        if (!res.ok) {
          var err = new Error('Panopto ' + res.status + ' from ' + path.split('?')[0])
          err.status = res.status
          throw err
        }
        try {
          return t ? JSON.parse(t) : null
        } catch (_) {
          var bad = new Error('Not JSON from ' + path.split('?')[0])
          bad.status = 'not json'
          throw bad
        }
      })
    }
  }

  function pPost(path, body) {
    return fetch(BASE + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(readJson(path))
  }

  function pGet(path) {
    return fetch(BASE + path, { credentials: 'include', headers: { accept: 'application/json' } }).then(readJson(path))
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

  // Panopto wraps results in d / Results / Data in different places. Find the array of objects.
  function listIn(data) {
    if (!data) return []
    if (Array.isArray(data)) return data
    var keys = ['d', 'Results', 'results', 'Data', 'data', 'Folders', 'folders', 'Items', 'items', 'Sessions']
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]]
      if (Array.isArray(v)) return v
      if (v && typeof v === 'object') {
        var inner = listIn(v)
        if (inner.length) return inner
      }
    }
    return []
  }

  function pick(o, names) {
    for (var i = 0; i < names.length; i++) if (o && o[names[i]] != null && o[names[i]] !== '') return o[names[i]]
    return null
  }

  function toFolder(o) {
    var id = pick(o, ['ID', 'Id', 'id', 'Key', 'FolderID', 'FolderId'])
    var name = pick(o, ['Name', 'name', 'FolderName', 'DisplayName', 'Value'])
    return id && GUID.test(String(id)) && name ? { id: String(id), name: String(name) } : null
  }

  function msDate(v) {
    if (!v) return null
    var m = /\/Date\((-?\d+)/.exec(String(v))
    var d = m ? new Date(Number(m[1])) : new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  function absUrl(v) {
    if (!v) return null
    try {
      return new URL(String(v), location.origin).toString()
    } catch (_) {
      return null
    }
  }

  function uniqFolders(list) {
    var seen = {}
    return list.filter(function (f) {
      if (!f || seen[f.id]) return false
      seen[f.id] = 1
      return true
    })
  }

  function folderQuery(extra) {
    var q = {
      parentId: null,
      folderSet: 1,
      includeMyFolder: false,
      includePersonalFolders: true,
      page: 0,
      sort: 'Depth',
      names: [],
      permissions: 'Viewer',
      searchQuery: null,
    }
    for (var k in extra) q[k] = extra[k]
    return q
  }

  // ---------- folders, with fallbacks ----------
  function attempt(label, fn) {
    return fn().then(
      function (data) {
        var folders = uniqFolders(listIn(data).map(toFolder))
        log(label + ': ' + folders.length + ' folder(s)', 'dim')
        return folders
      },
      function (e) {
        if (e instanceof LoginError) throw e
        log(label + ' failed (' + (e.status || e.message) + ')', 'dim')
        return []
      },
    )
  }

  function listFolders(moduleCodes) {
    // 1. Older Data.svc GetFolders, nested body (can 500).
    return attempt('GetFolders', function () {
      return pPost('/Services/Data.svc/GetFolders', { queryParameters: folderQuery({}) })
    })
      .then(function (f) {
        // 2. Same call with a flat body.
        return f.length ? f : attempt('GetFolders (flat)', function () {
          return pPost('/Services/Data.svc/GetFolders', folderQuery({}))
        })
      })
      .then(function (f) {
        // 3. Children of the empty GUID (root). Never GET the folders collection: that is 405.
        return f.length ? f : attempt('Root children', function () {
          return pGet('/api/v1/folders/' + EMPTY + '/children?pageNumber=0')
        })
      })
      .then(function (f) {
        // 4. A folder search for each of my module codes.
        if (f.length) return f
        var all = []
        return moduleCodes
          .reduce(function (p, code) {
            return p.then(function () {
              return attempt('Search ' + code, function () {
                return pGet('/api/v1/folders/search?searchQuery=' + encodeURIComponent(code) + '&pageNumber=0').catch(function (e) {
                  if (e instanceof LoginError) throw e
                  return pPost('/Services/Data.svc/GetFolders', folderQuery({ searchQuery: code }))
                })
              }).then(function (r) {
                all = all.concat(r)
              })
            })
          }, Promise.resolve())
          .then(function () {
            return uniqFolders(all)
          })
      })
  }

  // ---------- sessions ----------
  function sessionQuery(extra) {
    var q = {
      query: null,
      sortColumn: 1,
      sortAscending: false,
      maxResults: 250,
      page: 0,
      startDate: null,
      endDate: null,
      folderID: null,
      bookmarked: false,
      getFolderData: true,
      isSharedWithMe: false,
      isSubscriptionsPage: false,
      includeArchived: true,
      includeArchivedStateCount: true,
      sessionListOnlyArchived: false,
      includePlaylists: true,
    }
    for (var k in extra) q[k] = extra[k]
    return { queryParameters: q }
  }

  function toSession(o, folder) {
    var id = pick(o, ['DeliveryID', 'DeliveryId', 'SessionID', 'SessionId', 'Id', 'ID'])
    var title = pick(o, ['SessionName', 'Name', 'name', 'Title'])
    if (!id || !GUID.test(String(id)) || !title) return null
    var pct = pick(o, ['PercentCompleted', 'PercentWatched', 'ViewProgress', 'CompletionPercentage'])
    pct = pct == null ? null : Number(pct)
    // Some Panopto fields are 0-1 fractions, others 0-100.
    if (pct != null && pct > 0 && pct < 1) pct = pct * 100
    var dur = Number(pick(o, ['Duration', 'duration', 'SessionDuration']))
    return {
      id: String(id),
      title: String(title),
      folderId: String(pick(o, ['FolderID', 'FolderId']) || (folder && folder.id) || '') || null,
      folderName: String(pick(o, ['FolderName']) || (folder && folder.name) || '') || null,
      durationSeconds: isFinite(dur) && dur > 0 ? dur : null,
      deliveredAt: msDate(pick(o, ['StartTime', 'StartTimeUtc', 'DateTime', 'CreatedDate'])),
      viewerUrl: absUrl(pick(o, ['ViewerUrl', 'ViewerURL', 'EmbedUrl'])) || location.origin + '/Panopto/Pages/Viewer.aspx?id=' + id,
      thumbnailUrl: absUrl(pick(o, ['ThumbUrl', 'ThumbnailUrl', 'ThumbURL'])),
      percent: pct != null && isFinite(pct) ? pct : null,
    }
  }

  function sessionsFor(folder, codeGuess) {
    return pPost('/Services/Data.svc/GetSessions', sessionQuery({ folderID: folder.id }))
      .then(function (data) {
        return listIn(data).map(function (o) {
          return toSession(o, folder)
        })
      })
      .catch(function (e) {
        if (e instanceof LoginError) throw e
        log('Sessions for ' + folder.name + ' failed: ' + e.message, 'dim')
        return []
      })
      .then(function (list) {
        list = list.filter(Boolean)
        if (list.length || !codeGuess) return list
        // Fallback: search by module code, keep only this folder's recordings.
        return pPost('/Services/Data.svc/GetSessions', sessionQuery({ query: codeGuess }))
          .then(function (data) {
            return listIn(data)
              .map(function (o) {
                return toSession(o, null)
              })
              .filter(function (s) {
                return s && (!s.folderId || s.folderId === folder.id)
              })
          })
          .catch(function (e) {
            if (e instanceof LoginError) throw e
            log('Search for ' + codeGuess + ' failed: ' + e.message, 'dim')
            return []
          })
      })
  }

  // ---------- transcripts ----------
  function srtToText(srt) {
    return srt
      .replace(/\r/g, '')
      .split(/\n\n+/)
      .map(function (block) {
        var lines = block.split('\n')
        var t = /(\d\d):(\d\d):(\d\d)/.exec(block)
        var text = lines
          .filter(function (l) {
            return l && !/^\d+$/.test(l) && l.indexOf('-->') === -1
          })
          .join(' ')
          .trim()
        if (!text) return ''
        var stamp = t ? (t[1] !== '00' ? t[1] + ':' : '') + t[2] + ':' + t[3] : ''
        return (stamp ? '[' + stamp + '] ' : '') + text
      })
      .filter(Boolean)
      .join('\n')
  }

  function transcriptFor(id) {
    return fetch(BASE + '/Pages/Transcription/GenerateSRT.ashx?id=' + id + '&language=0', { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) return null
        return res.text().then(function (t) {
          if (!t || t.trim().charAt(0) === '<' || t.indexOf('-->') === -1) return null
          return srtToText(t)
        })
      })
      .catch(function () {
        return null
      })
  }

  function withTranscripts(sessions, have) {
    var i = 0
    function worker() {
      if (i >= sessions.length) return Promise.resolve()
      var s = sessions[i++]
      if (have[s.id]) return worker()
      return transcriptFor(s.id).then(function (t) {
        if (t) s.transcript = t
        return worker()
      })
    }
    return Promise.all([worker(), worker(), worker(), worker()]).then(function () {
      return sessions
    })
  }

  function codeIn(name, codes) {
    var up = String(name).toUpperCase().replace(/\s+/g, '')
    for (var i = 0; i < codes.length; i++) if (up.indexOf(codes[i]) > -1) return codes[i]
    return null
  }

  // ---------- run ----------
  var totals = { saved: 0, created: 0 }
  log('Asking hub for your modules…', 'dim')
  hub('/api/sync/panopto/config')
    .then(function (state) {
      var codes = state.moduleCodes || []
      var known = state.folders || []
      var archived = {}
      known.forEach(function (f) {
        if (f.archived) archived[f.id] = 1
      })
      var have = {}
      ;(state.haveTranscripts || []).forEach(function (id) {
        have[id] = 1
      })
      if (!codes.length) throw new Error('Add your modules in hub first, so the sync knows which folders to read.')
      log('Modules: ' + codes.join(', '))

      return listFolders(codes)
        .catch(function (e) {
          if (e instanceof LoginError) throw e
          return []
        })
        .then(function (found) {
          if (!found.length) {
            // Do not abort: use the folders already saved on my modules.
            log('Folder list failed. Using ' + known.length + ' saved folder(s).', 'dim')
            found = known.map(function (f) {
              return { id: f.id, name: f.name }
            })
          }
          var knownIds = {}
          known.forEach(function (f) {
            knownIds[f.id] = f
          })
          // Target folders already matched to a module, or whose name has one of my codes.
          var targets = found.filter(function (f) {
            if (archived[f.id]) return false
            return (knownIds[f.id] && knownIds[f.id].moduleCode) || codeIn(f.name, codes)
          })
          // Folders saved earlier that the list missed.
          known.forEach(function (f) {
            if (!f.archived && f.moduleCode && !targets.some(function (t) { return t.id === f.id }))
              targets.push({ id: f.id, name: f.name })
          })
          if (!targets.length) {
            log('No folders match ' + codes.join(', ') + '. Running a session search instead.', 'dim')
            targets = codes.map(function (c) {
              return { id: null, name: c, searchOnly: c }
            })
          }

          return targets.reduce(function (p, folder) {
            return p.then(function () {
              var guess = (knownIds[folder.id] && knownIds[folder.id].moduleCode) || codeIn(folder.name, codes) || folder.searchOnly
              var get = folder.id
                ? sessionsFor(folder, guess)
                : pPost('/Services/Data.svc/GetSessions', sessionQuery({ query: folder.searchOnly })).then(function (d) {
                    return listIn(d)
                      .map(function (o) {
                        return toSession(o, null)
                      })
                      .filter(Boolean)
                  })
              return get.then(function (sessions) {
                sessions = sessions.filter(function (s) {
                  return !s.folderId || !archived[s.folderId]
                })
                log(folder.name + ': ' + sessions.length + ' recording(s)')
                if (!sessions.length) return
                return withTranscripts(sessions, have).then(function () {
                  var chunks = []
                  for (var i = 0; i < sessions.length; i += 20) chunks.push(sessions.slice(i, i + 20))
                  return chunks.reduce(function (q, chunk, n) {
                    return q.then(function () {
                      return hub('/api/sync/panopto', { folders: n === 0 && folder.id ? [{ id: folder.id, name: folder.name }] : [], sessions: chunk }).then(function (r) {
                        totals.saved += r.saved || 0
                        totals.created += r.created || 0
                      })
                    })
                  }, Promise.resolve())
                })
              })
            })
          }, Promise.resolve())
        })
    })
    .then(function () {
      log('Done. ' + totals.saved + ' lecture(s) saved, ' + totals.created + ' new.', 'good')
      log('Match any new folders to modules on the hub Lectures page.', 'dim')
    })
    .catch(function (e) {
      log(e && e.message ? e.message : String(e), 'bad')
    })
})()
