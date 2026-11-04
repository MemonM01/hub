import 'server-only'
import JSZip from 'jszip'
import mammoth from 'mammoth'

const TEXT_LIMIT = 400_000

export function bytesToText(bytes: Uint8Array): { text: string; truncated: boolean } {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return text.length > TEXT_LIMIT
    ? { text: text.slice(0, TEXT_LIMIT), truncated: true }
    : { text, truncated: false }
}

/** docx -> HTML. Mammoth escapes text; we also drop script-y links. */
export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })
  return value
    .replace(/\s(href|src)\s*=\s*"\s*(javascript|vbscript):[^"]*"/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, '')
}

export type Slide = { n: number; lines: string[] }

/** pptx -> text per slide, in slide order. */
export async function pptxToSlides(bytes: Uint8Array): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(bytes)
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const slides: Slide[] = []
  for (const name of names) {
    const xml = await zip.file(name)!.async('string')
    const lines = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map((p) => [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXml(t[1])).join(''))
      .map((l) => l.trim())
      .filter(Boolean)
    slides.push({ n: Number(name.match(/\d+/)![0]), lines })
  }
  return slides
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
