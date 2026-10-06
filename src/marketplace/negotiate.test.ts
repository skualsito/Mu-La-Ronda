import { describe, expect, it, vi } from 'vitest';
import type { ApiListing, ApiOffer } from './api';
import { MarketplaceStore, negotiateWhisper, type MarketApi } from './state';

/** Mu La Ronda: adverts "to negotiate" - no price, a whisper instead of a buy. */

const sword = { group: 0, num: 5, lvl: 9 } as ApiListing['item'];

const offer = (id: string, seller: string): ApiOffer => ({
  id,
  sellerCharacter: seller,
  item: sword,
  category: 'weapons',
  note: 'por alas',
  listedAt: 2,
  expiresAt: 99,
});

const priced: ApiListing = {
  id: 'L1',
  seller: 'bob',
  price: 5000,
  item: sword,
  category: 'weapons',
  state: 'active',
  buyer: null,
  listedAt: 1,
};

function setup() {
  const api = {
    browse: vi.fn(async () => ({ total: 1, listings: [priced] })),
    mine: vi.fn(async () => ({ listings: [] as ApiListing[], balance: 0, offers: [offer('mine', 'Me')] })),
    offers: vi.fn(async () => ({ offers: [offer('o1', 'Seller'), offer('mine', 'Me')] })),
    offer: vi.fn(async () => ({ offer: offer('o2', 'Me') })),
    removeOffer: vi.fn(async () => ({ removed: true })),
  } as unknown as MarketApi;
  const whisper = vi.fn(() => true);
  const store = new MarketplaceStore();
  store.listings = [];
  store.attach({ api, chat: { whisper } });
  return { store, api, whisper };
}

describe('to negotiate', () => {
  it('loads adverts beside the priced listings, own ones once and marked mine', async () => {
    const { store } = setup();
    await store.refresh();
    const adverts = store.listings.filter(l => l.negotiate);
    expect(adverts.map(l => [l.offerId, !!l.mine])).toEqual([
      ['mine', true],
      ['o1', false],
    ]);
    expect(adverts.every(l => l.price === 0 && store.canAfford(l))).toBe(true);
  });

  it('puts adverts after priced listings when sorting by price', async () => {
    const { store } = setup();
    await store.refresh();
    store.setSort('price-asc');
    expect(store.matching[0].id).toBe('L1');
  });

  it('whispers the seller character instead of buying', async () => {
    const { store, whisper } = setup();
    await store.refresh();
    const advert = store.listings.find(l => l.offerId === 'o1');
    if (!advert) throw new Error('advert missing');
    store.negotiate(advert);
    expect(whisper).toHaveBeenCalledWith('Seller', expect.stringContaining('on the market'));
    expect(store.flash).toContain('Seller');
  });

  it('takes an own advert down through the service', async () => {
    const { store, api } = setup();
    await store.refresh();
    const own = store.listings.find(l => l.offerId === 'mine');
    if (!own) throw new Error('own advert missing');
    await store.cancelListing(own.id);
    expect(api.removeOffer).toHaveBeenCalledWith('mine');
  });

  it('keeps the whisper inside the chat limit', () => {
    const line = negotiateWhisper('Excellent Great Reign Crossbow of the Ancients +15');
    expect(line.length).toBeLessThanOrEqual(60);
    expect(line).toContain('…');
  });
});
