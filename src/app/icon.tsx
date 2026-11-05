import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// Simple distinct mark: teal square, cross with a ring at the centre.
export function HubMark({ px }: { px: number }) {
  const u = px / 32
  return (
    <div
      style={{
        width: px,
        height: px,
        background: '#24508a',
        borderRadius: 8 * u,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', width: 2.5 * u, height: 16 * u, background: '#f4f5f3', borderRadius: u }} />
      <div style={{ position: 'absolute', width: 16 * u, height: 2.5 * u, background: '#f4f5f3', borderRadius: u }} />
      <div
        style={{
          position: 'absolute',
          width: 11.5 * u,
          height: 11.5 * u,
          borderRadius: 999,
          background: '#24508a',
          border: `${2.5 * u}px solid #f4f5f3`,
        }}
      />
    </div>
  )
}

export default function Icon() {
  return new ImageResponse(<HubMark px={512} />, size)
}
