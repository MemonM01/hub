const $ = (id) => document.getElementById(id)

function render(state) {
  const log = $('log')
  log.innerHTML = ''
  for (const line of state?.lines ?? []) {
    const d = document.createElement('div')
    d.textContent = line.msg
    if (line.tone) d.className = line.tone
    log.appendChild(d)
  }
  log.scrollTop = log.scrollHeight
  $('run').disabled = !!state?.running
  $('run').textContent = state?.running ? 'Syncing…' : 'Sync Minerva now'
}

async function init() {
  const { origin, token } = await chrome.storage.local.get(['origin', 'token'])
  $('origin').value = origin || 'https://hub-memonm01s-projects.vercel.app'
  $('token').value = ''
  $('setup').hidden = !!token
  $('main').hidden = !token
  const { status } = await chrome.storage.session.get('status')
  render(status)
}

$('save').onclick = async () => {
  const origin = $('origin').value.trim().replace(/\/$/, '')
  const token = $('token').value.trim()
  if (!/^https?:\/\//.test(origin) || !token.startsWith('hub_sync_')) {
    $('token').placeholder = 'Paste a token that starts with hub_sync_'
    return
  }
  await chrome.storage.local.set({ origin, token })
  init()
}
$('edit').onclick = () => {
  $('setup').hidden = false
  $('main').hidden = true
}
$('run').onclick = () => chrome.runtime.sendMessage({ type: 'sync-minerva' })

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.status) render(changes.status.newValue)
})
init()
