/**
 * Plain-text sanitization for any text that originates outside GAMEPULSE.
 * GAMEPULSE never renders source HTML; stored titles/summaries are plain text.
 */

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Removes tags, decodes entities, strips control characters and collapses whitespace. */
export function sanitizePlainText(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\ufeff]/g, '')
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Truncates on a character boundary with an ellipsis, never exceeding maxLength. */
export function truncateText(input: string, maxLength: number): string {
  const chars = Array.from(input);
  if (chars.length <= maxLength) return input;
  return `${chars
    .slice(0, Math.max(0, maxLength - 1))
    .join('')
    .trimEnd()}…`;
}

/** Collapses whitespace including newlines into single spaces (for one-line titles). */
export function toSingleLine(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}
