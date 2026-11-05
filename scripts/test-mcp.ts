import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { windowed } from '../src/lib/mcp/window'

const text = 'intro '.repeat(2000) + 'The page table maps virtual pages to frames. ' + 'filler '.repeat(3000) + 'A TLB caches page table entries.'
const a = windowed(text, 'page table')
assert.equal(a.windows.length, 2)
assert.ok(a.windows[0].text.includes('maps virtual pages'))
assert.ok(a.total_chars === text.length)
const b = windowed(text, null, { size: 100 })
assert.equal(b.windows[0].text.length, 100)
assert.ok(b.note)
assert.equal(windowed(text, 'kangaroo').windows.length, 0)
// PKCE S256 test vector from RFC 7636 appendix B
const v = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
assert.equal(createHash('sha256').update(v).digest('base64url'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
console.log('mcp: passed')
