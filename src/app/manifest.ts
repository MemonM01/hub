import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'hub',
    short_name: 'hub',
    description: 'My University of Leeds work in one place.',
    start_url: '/',
    display: 'browser',
    background_color: '#f4f5f3',
    theme_color: '#24508a',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
