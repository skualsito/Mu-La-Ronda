/**
 * Mu La Ronda: links in the server's announcements. The admin panel writes
 * them as `<a href="https://...">label</a>` (its "Agregar link" button), and a
 * bare `https://...` counts too. Only http(s) addresses become links; no other
 * markup is read - everything else is shown as the text it is, so a message
 * can never inject anything into the page.
 */

export type RichSegment = { text: string; href?: string };

const ANCHOR = /<a\s+href\s*=\s*(["'])(.*?)\1\s*>(.*?)<\/a>/gi;
const BARE_URL = /https?:\/\/[^\s<>"']+/gi;

/** The address when it is a web one, else null. */
export function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function bareLinks(text: string, out: RichSegment[]): void {
  let last = 0;
  for (const m of text.matchAll(BARE_URL)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    const href = safeHref(m[0]);
    out.push(href ? { text: m[0], href } : { text: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
}

/** The text cut into plain runs and links, in order. */
export function parseRichText(text: string): RichSegment[] {
  const out: RichSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(ANCHOR)) {
    const at = m.index ?? 0;
    if (at > last) bareLinks(text.slice(last, at), out);
    const href = safeHref(m[2]);
    const label = m[3] || m[2];
    out.push(href ? { text: label, href } : { text: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) bareLinks(text.slice(last), out);
  return out.filter(s => s.text.length > 0);
}

/** Whether there is any link to draw. */
export function hasLinks(text: string): boolean {
  return parseRichText(text).some(s => s.href);
}

/** What the line reads as, links by their label (for measuring and logs). */
export function plainText(text: string): string {
  return parseRichText(text).map(s => s.text).join('');
}

/** Opens a link from the game in a new tab, away from the game's own page. */
export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}
