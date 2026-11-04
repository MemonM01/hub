'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createSyncToken } from '@/lib/actions/tokens'

export const BOOKMARKLETS = [
  { id: 'panopto', label: 'hub · Panopto', where: 'leeds.cloud.panopto.eu' },
  { id: 'minerva', label: 'hub · Minerva', where: 'minerva.leeds.ac.uk' },
] as const

// The bookmark only loads the script, with a cache-busting query, so a new deploy
// is picked up without making a new bookmark.
export function bookmarkletCode(origin: string, token: string, id: string) {
  const o = JSON.stringify(origin)
  const t = JSON.stringify(token)
  return `javascript:(function(){window.__hub={origin:${o},token:${t}};var s=document.createElement('script');s.src=${o}+'/bookmarklets/${id}.js?v='+Date.now();s.onerror=function(){alert('hub: could not load the script from '+${o})};document.body.appendChild(s)})();`
}

function DragLink({ code, label }: { code: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  // React refuses javascript: hrefs in JSX, so set it on the element directly.
  useEffect(() => {
    ref.current?.setAttribute('href', code)
  }, [code])
  return (
    <a
      ref={ref}
      onClick={(e) => e.preventDefault()}
      className="inline-block cursor-grab rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
    >
      {label}
    </a>
  )
}

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const [name, setName] = useState('Bookmarklets')
  const [token, setToken] = useState<string>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState<string>()
  const [pending, start] = useTransition()

  if (!token) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs text-muted">Token name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1 w-56" />
        </label>
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const res = await createSyncToken(name)
              if (res.error) setError(res.error)
              else setToken(res.token)
            })
          }
        >
          {pending ? 'Creating…' : 'Create token and bookmarklets'}
        </button>
        {error ? <p className="w-full text-sm text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-accent p-4">
      <p className="text-sm">
        Drag each button to your bookmarks bar now. The token is inside them and is not shown again. If you lose
        them, revoke this token and make a new one.
      </p>
      {origin.startsWith('http://') ? (
        <p className="text-xs text-muted">
          These point at {origin}. They only work while the dev server is running. Make new ones after the app is on
          Vercel.
        </p>
      ) : null}
      <ul className="space-y-3">
        {BOOKMARKLETS.map((b) => {
          const code = bookmarkletCode(origin, token, b.id)
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-3">
              <DragLink code={code} label={b.label} />
              <span className="text-xs text-muted">Click it on {b.where} while logged in.</span>
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(code)
                  setCopied(b.id)
                }}
              >
                {copied === b.id ? 'Copied' : 'Copy code'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
