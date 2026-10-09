/**
 * Mu La Ronda: why an event refused you, in words.
 *
 * OpenMU answers a refused Chaos Castle or Blood Castle entry with a bare
 * `Failed` result, and the client reads `Failed` the way the original does: the
 * Cloak of Invisibility is of the wrong level. When the real reason is an item
 * the event will not let in (a Fenrir, a Uniria, a transformation ring), the
 * server says so just before, as a blue line - "Can't enter event with
 * equipped item 'Horn of Fenrir'." That line is noted here, and the entry
 * result turns it into the notice: "Take off the Horn of Fenrir before entering
 * Chaos Castle."
 */

import { t } from '../i18n';
import { matchServerText, translateServerText } from '../i18n/serverText';
import { ItemsDatabase, itemBaseName } from './itemsDatabase';

/** The blue line and the result arrive in the same burst; this is generous. */
const FRESH_MS = 2000;

let last: { text: string; at: number } | null = null;

/** Every blue line the server sends passes through here (logic.ts). */
export function noteServerLine(text: string, now = Date.now()): void {
  last = { text, at: now };
}

let byEnglishName: Map<string, string> | null = null;

/** The item's name in the player's language, from the English name the server uses. */
function localItemName(english: string): string {
  if (!byEnglishName) {
    byEnglishName = new Map();
    for (let group = 0; group < 16; group++) {
      for (let index = 0; index < 512; index++) {
        const name = ItemsDatabase.getItem(group, index)?.ItemName;
        if (name) byEnglishName.set(name.toLowerCase(), `${group}:${index}`);
      }
    }
  }
  const key = byEnglishName.get(english.toLowerCase());
  if (!key) return english;
  const [group, index] = key.split(':').map(Number);
  return itemBaseName(group, index) || english;
}

/**
 * The notice for a refused entry to `eventName`, when the server explained it
 * a moment ago; null otherwise (the caller keeps its own text).
 */
export function eventEntryRefusal(eventName: string, now = Date.now()): string | null {
  const line = last;
  last = null;
  if (!line || now - line.at > FRESH_MS) return null;

  const found = matchServerText(line.text);
  if (found?.key === 'serverMessage.cantEnterEventWithItem') {
    return t('event.removeItemFirst', { 0: localItemName(found.params['0'] ?? ''), 1: eventName });
  }
  // A map the event warps to has its own requirement (a Moonstone Pendant for Kanturu).
  if (found?.key === 'serverMessage.missingMapRequirement') return translateServerText(line.text);
  // Anything else that came before (a drop, a chat line) is not the reason.
  return null;
}
