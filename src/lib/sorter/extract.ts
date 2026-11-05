import 'server-only'
import mammoth from 'mammoth'
import { extractText as pdfText, getDocumentProxy } from 'unpdf'
import { pptxToSlides } from '@/lib/preview'
import { extOf } from '@/lib/mime'

export const MAX_TEXT = 400_000

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

const TEXT_EXT = new Set(['txt', 'md', 'csv', 'json', 'py', 'java', 'c', 'h', 'cpp', 'js', 'ts', 'sql', 'tex', 'kt', 'hs', 'r', 'm', 'ipynb'])

/** Plain text from the formats we can read. Null when there is no text to get (images, archives). */
export async function extractText(bytes: Uint8Array, filename: string, mime: string | null): Promise<string | null> {
  const ext = extOf(filename)
  let text: string | null = null
  if (ext === 'pdf' || mime === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { text: t } = await pdfText(pdf, { mergePages: true })
    text = Array.isArray(t) ? t.join('\n') : t
  } else if (ext === 'docx') {
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
  } else if (ext === 'pptx') {
    text = (await pptxToSlides(bytes)).map((s) => `Slide ${s.n}: ${s.lines.join('\n')}`).join('\n\n')
  } else if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
    text = htmlToText(new TextDecoder().decode(bytes))
  } else if (TEXT_EXT.has(ext) || mime?.startsWith('text/')) {
    text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
  if (!text) return null
  const clean = text.replace(/\u0000/g, '').trim()
  return clean ? clean.slice(0, MAX_TEXT) : null
}
