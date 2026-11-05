import assert from 'node:assert/strict'
import { fileLinks, safeUrl } from '../src/lib/link-import'
const page = new URL('https://comp2870-2627.github.io/linear-algebra-notes/slides/')
const html = `<a href="mailto:x@y">mail</a><a href="https://comp2870-2627.github.io/linear-algebra-notes/slides/lec01.html">lec01.html: Introduction to Linear Algebra</a>
<a href="lec02.html#top">lec02.html: <em>Systems</em></a><a href="../index.html">home</a><a href="https://evil.example/x.pdf">x</a><a href="lec02.html">dup</a>`
const l = fileLinks(html, page)
assert.deepEqual(l.map((x) => x.url.pathname.split('/').pop()), ['lec01.html', 'lec02.html'])
assert.equal(l[1].text, 'lec02.html: Systems')
assert.equal(safeUrl('http://x.com'), null)
assert.equal(safeUrl('https://127.0.0.1/'), null)
assert.equal(safeUrl('https://localhost/'), null)
assert.ok(safeUrl('https://comp2870-2627.github.io/a/'))
console.log('links: passed')
