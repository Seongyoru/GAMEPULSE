import { ImageResponse } from 'next/og';

export const alt = 'GAMEPULSE — All Your Games. One Pulse.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

/** Default social card (Latin text only: the bundled OG font has no Hangul glyphs). */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: '#0a0c11',
        color: '#e7eaf0',
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fb7185"
        strokeWidth="2.4"
      >
        <path d="M2 12h4l2.5-6 4 12 3-9 1.5 3H22" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: '0.04em', marginTop: 24 }}>
        GAMEPULSE
      </div>
      <div style={{ fontSize: 44, color: '#8e97a8', marginTop: 12 }}>
        All Your Games. One Pulse.
      </div>
    </div>,
    size,
  );
}
