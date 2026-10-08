import {
  CloseNpcRequestPacket,
  LahapJewelMixRequestMixTypeEnum,
  LahapJewelMixRequestPacket,
  LahapJewelMixRequestStackSizeEnum,
} from './packets/ClientToServerPackets';

/**
 * Mu La Ronda: Lahap, who packs jewels into bundles of 10, 20 or 30 and
 * unpacks them again. OpenMU runs both (`ItemStackAction`, mix numbers in
 * `GameConfigurationInitializer.CreateJewelMixes`); the client only had no
 * window for him, so talking to him did nothing.
 *
 * A bundle is one item of group 12 whose level is its size: +0 holds 10, +1
 * 20, +2 30.
 */

export type JewelMix = {
  /** The server's mix number (`LahapJewelMixRequest.Item`). */
  mix: number;
  /** The single jewel. */
  group: number;
  num: number;
  /** The bundle (group 12). */
  packed: number;
};

export const JEWEL_MIXES: readonly JewelMix[] = [
  { mix: 0, group: 14, num: 13, packed: 30 }, // Bless
  { mix: 1, group: 14, num: 14, packed: 31 }, // Soul
  { mix: 2, group: 14, num: 16, packed: 136 }, // Life
  { mix: 3, group: 14, num: 22, packed: 137 }, // Creation
  { mix: 4, group: 14, num: 31, packed: 138 }, // Guardian
  { mix: 5, group: 14, num: 41, packed: 139 }, // Gemstone
  { mix: 6, group: 14, num: 42, packed: 140 }, // Harmony
  { mix: 7, group: 12, num: 15, packed: 141 }, // Chaos
  { mix: 8, group: 14, num: 43, packed: 142 }, // Lower Refine Stone
  { mix: 9, group: 14, num: 44, packed: 143 }, // Higher Refine Stone
];

/** Zen per ten jewels packed, and to unpack a bundle (ItemStackAction). */
export const PACK_FEE_PER_TEN = 500_000;
export const UNPACK_FEE = 1_000_000;

export const PACK_SIZES = [10, 20, 30] as const;

/** Jewels a bundle of `level` holds. */
export function bundleSize(level: number): number {
  return (Math.max(0, level) + 1) * 10;
}

type Slotted = { slot: number; item: { group: number; num: number; lvl?: number } | null };

/** How many of each single jewel the bag holds, by mix number. */
export function looseJewels(bag: readonly Slotted[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const { item } of bag) {
    if (!item) continue;
    const mix = JEWEL_MIXES.find(m => m.group === item.group && m.num === item.num);
    if (mix) counts.set(mix.mix, (counts.get(mix.mix) ?? 0) + 1);
  }
  return counts;
}

/** The bundles in the bag, with the slot each sits in. */
export function bundlesIn(bag: readonly Slotted[]): { slot: number; mix: JewelMix; size: number }[] {
  const out: { slot: number; mix: JewelMix; size: number }[] = [];
  for (const { slot, item } of bag) {
    if (!item || item.group !== 12) continue;
    const mix = JEWEL_MIXES.find(m => m.packed === item.num);
    if (mix) out.push({ slot, mix, size: bundleSize(item.lvl ?? 0) });
  }
  return out;
}

const SIZE_ENUM: Record<(typeof PACK_SIZES)[number], LahapJewelMixRequestStackSizeEnum> = {
  10: LahapJewelMixRequestStackSizeEnum.Ten,
  20: LahapJewelMixRequestStackSizeEnum.Twenty,
  30: LahapJewelMixRequestStackSizeEnum.Thirty,
};

/** `LahapJewelMixRequest` to pack `size` jewels of a mix. */
export function packRequest(mix: number, size: (typeof PACK_SIZES)[number]): DataView {
  const packet = LahapJewelMixRequestPacket.createPacket();
  packet.Operation = LahapJewelMixRequestMixTypeEnum.Mix;
  packet.Item = mix;
  packet.MixingStackSize = SIZE_ENUM[size];
  return packet.buffer;
}

/** `LahapJewelMixRequest` to unpack the bundle in inventory slot `slot`. */
export function unpackRequest(mix: number, slot: number): DataView {
  const packet = LahapJewelMixRequestPacket.createPacket();
  packet.Operation = LahapJewelMixRequestMixTypeEnum.Unmix;
  packet.Item = mix;
  packet.UnmixingSourceSlot = slot;
  return packet.buffer;
}

/** Leaving Lahap: OpenMU keeps the dialog open until told (TalkNpcAction). */
export function closeNpcRequest(): DataView {
  return CloseNpcRequestPacket.createPacket().buffer;
}
