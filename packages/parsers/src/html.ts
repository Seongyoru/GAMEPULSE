/**
 * Converts fetched HTML into plain text for parsing. The result is only used as parser input
 * and evidence matching — GAMEPULSE never renders fetched HTML.
 */
import { sanitizePlainText } from '@gamepulse/domain';

const BLOCK_TAGS =
  /<\/?(?:p|div|section|article|header|footer|li|ul|ol|tr|table|h[1-6]|blockquote|pre)\b[^>]*>/gi;

export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(BLOCK_TAGS, '\n');
  return sanitizePlainText(withBreaks).replace(/\n{3,}/g, '\n\n');
}
