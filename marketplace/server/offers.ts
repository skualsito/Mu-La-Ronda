import { randomUUID } from 'node:crypto';
import { audit, db } from './db';
import type { Item } from './listings';

/**
 * Mu La Ronda: adverts for items "to negotiate" (schema/004_offers.sql).
 *
 * Nothing moves here and nothing is held: the advert is a picture of an item
 * in the seller's bag and the character to whisper about it. The deal itself
 * is the game's trade window, where both sides see the real item, so the
 * service does not have to vouch for the picture - only keep it tidy: a cap
 * per account, a lifetime, and the seller's own way to take it down.
 */

export type Offer = {
  id: string;
  /** The account, never sent to other players. */
  seller: string;
  sellerCharacter: string;
  slot: number;
  item: Item;
  category: string;
  note: string;
  listedAt: number;
  expiresAt: number;
};

/** What other players see: the character to whisper, never the account. */
export type PublicOffer = Omit<Offer, 'seller' | 'slot'>;

type OfferRow = {
  id: string;
  seller: string;
  seller_char: string;
  slot: number;
  item_json: string;
  category: string;
  note: string;
  created_at: number;
  expires_at: number;
};

export const OFFER_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_OFFERS_PER_ACCOUNT = 10;
export const NOTE_MAX = 60;

const toOffer = (row: OfferRow): Offer => ({
  id: row.id,
  seller: row.seller,
  sellerCharacter: row.seller_char,
  slot: row.slot,
  item: JSON.parse(row.item_json) as Item,
  category: row.category,
  note: row.note,
  listedAt: row.created_at,
  expiresAt: row.expires_at,
});

export const publicOffer = ({ seller: _seller, slot: _slot, ...rest }: Offer): PublicOffer => rest;

/** Printable text only, trimmed to what a card has room for. */
export function cleanNote(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
}

export function createOffer(
  input: { seller: string; sellerCharacter: string; slot: number; item: Item; category: string; note: string },
  now = Date.now()
): Offer {
  if (bySeller(input.seller, now).length >= MAX_OFFERS_PER_ACCOUNT) {
    throw new Error(`You already have ${MAX_OFFERS_PER_ACCOUNT} items up to negotiate. Take one down first.`);
  }

  const id = randomUUID();
  // The same bag slot advertised twice is the same item: the newer advert replaces the older one.
  db.query('DELETE FROM offers WHERE seller = ? AND seller_char = ? AND slot = ?').run(
    input.seller,
    input.sellerCharacter,
    input.slot
  );
  db.query(
    `INSERT INTO offers
       (id, seller, seller_char, slot, item_group, item_number, item_json, category, note, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.seller,
    input.sellerCharacter,
    input.slot,
    input.item.group,
    input.item.num,
    JSON.stringify(input.item),
    input.category,
    input.note,
    now,
    now + OFFER_TTL_MS
  );
  audit('offer created', { listing: id, account: input.seller, detail: { slot: input.slot, item: [input.item.group, input.item.num] } });

  const row = db.query('SELECT * FROM offers WHERE id = ?').get(id) as OfferRow | null;
  if (!row) throw new Error('the offer was not written');
  return toOffer(row);
}

export function browse(options: { category?: string } = {}, now = Date.now()): Offer[] {
  const rows = options.category && options.category !== 'all'
    ? db.query('SELECT * FROM offers WHERE expires_at > ? AND category = ? ORDER BY created_at DESC LIMIT 500').all(now, options.category)
    : db.query('SELECT * FROM offers WHERE expires_at > ? ORDER BY created_at DESC LIMIT 500').all(now);
  return (rows as OfferRow[]).map(toOffer);
}

export function bySeller(account: string, now = Date.now()): Offer[] {
  const rows = db.query('SELECT * FROM offers WHERE seller = ? AND expires_at > ? ORDER BY created_at DESC').all(account, now);
  return (rows as OfferRow[]).map(toOffer);
}

/** Takes an advert down; only its own seller may. */
export function remove(id: string, account: string): boolean {
  const result = db.query('DELETE FROM offers WHERE id = ? AND seller = ?').run(id, account);
  if (result.changes > 0) audit('offer removed', { listing: id, account });
  return result.changes > 0;
}

/** Drops the adverts past their lifetime; what the sweep calls. */
export function purgeExpired(now = Date.now()): number {
  return db.query('DELETE FROM offers WHERE expires_at <= ?').run(now).changes;
}
