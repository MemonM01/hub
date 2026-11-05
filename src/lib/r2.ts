import 'server-only'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

let client: S3Client | null = null
function r2() {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2AccountId()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.r2AccessKeyId(), secretAccessKey: env.r2SecretAccessKey() },
  })
  return client
}

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

/** Object key: per user, per file row, with a safe name for downloads. */
export function objectKey(userId: string, fileId: string, filename: string) {
  const safe = filename.normalize('NFKD').replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file'
  return `u/${userId}/${fileId}/${safe}`
}

/** Short-lived signed PUT the browser uses to send bytes straight to R2. */
export function signPut(key: string, contentType: string) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: env.r2Bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 600, signableHeaders: new Set(['content-type']) },
  )
}

/** Short-lived signed GET, inline for previews or as an attachment for downloads. */
export function signGet(key: string, filename: string, mode: 'inline' | 'attachment', contentType?: string) {
  const name = encodeURIComponent(filename)
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: env.r2Bucket(),
      Key: key,
      ResponseContentDisposition: `${mode}; filename*=UTF-8''${name}`,
      ...(contentType ? { ResponseContentType: contentType } : {}),
    }),
    { expiresIn: 600 },
  )
}

/** The real size and type, or null if the bytes are not there. */
export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: env.r2Bucket(), Key: key }))
    return { size: res.ContentLength ?? 0, contentType: res.ContentType }
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404) return null
    throw e
  }
}

export async function getObjectBytes(key: string, maxBytes = 50 * 1024 * 1024): Promise<Uint8Array> {
  const res = await r2().send(new GetObjectCommand({ Bucket: env.r2Bucket(), Key: key }))
  if ((res.ContentLength ?? 0) > maxBytes) throw new Error('File too large to read here')
  return res.Body!.transformToByteArray()
}

export async function deleteObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: env.r2Bucket(), Key: key }))
}

/** Server-side upload, used only to relay small Minerva files that the browser could not PUT. */
export async function putBytes(key: string, bytes: Uint8Array, contentType: string) {
  await r2().send(new PutObjectCommand({ Bucket: env.r2Bucket(), Key: key, Body: bytes, ContentType: contentType }))
}
