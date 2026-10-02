import type { MetadataRoute } from 'next';
import { ko } from '@/lib/i18n';

// Built once per deployment (also required by the static preview export).
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GAMEPULSE',
    short_name: 'GAMEPULSE',
    description: ko.site.description,
    lang: 'ko',
    start_url: '/today',
    display: 'standalone',
    background_color: '#0a0c11',
    theme_color: '#0a0c11',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
