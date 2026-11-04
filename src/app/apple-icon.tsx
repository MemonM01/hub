import { ImageResponse } from 'next/og'
import { HubMark } from './icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  // iOS rounds the corners itself, so fill the whole square.
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: 'flex', background: '#1f5f5b' }}>
        <HubMark px={180} />
      </div>
    ),
    size,
  )
}
