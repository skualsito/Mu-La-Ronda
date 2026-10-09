import { CharacterClassNumber } from './types';

/** The two fields of an item these rules read. */
type PartItem = { group: number; num: number };

/**
 * Mu La Ronda: the Rage Fighter wears the common sets he can equip - Leather,
 * Scale, Brass and Plate - as models of his own, HelmMonk01-04 and so on
 * (`ModifyTypeCommonItemMonk`, MonkSystem.cpp:196). Drawn with the Dark
 * Knight's models he wore another man's armour. Gloves (group 10) land on the
 * boots there too, as in the original: he has no glove model of his own.
 */
const RAGE_FIGHTER_COMMON_SETS = [5, 6, 8, 9];
const MONK_PARTS: Readonly<Record<number, string>> = { 7: 'HelmMonk', 8: 'ArmorMonk', 9: 'PantMonk', 10: 'BootMonk', 11: 'BootMonk' };

/**
 * Mu La Ronda: the helms the class head stays on under (`SetCharacterScale`,
 * ZzzCharacter.cpp:12116-12129): Bronze, Pad, the elf helms Vine to Spirit and
 * four of the later ones. Every other helm is a head of its own.
 */
const OPEN_HELMS = new Set([0, 2, 10, 11, 12, 13, 63, 65, 68, 70]);

export function showsClassHead(helm: PartItem | null): boolean {
  return !helm || OPEN_HELMS.has(helm.num);
}

/**
 * Mu La Ronda: the Dark Lord wears the Bronze, Leather, Scale, Brass and Plate
 * helms as masks over his own hair (`MODEL_MASK_HELM + index`,
 * ZzzCharacter.cpp:9609-9620): MaskHelmMale01/06/07/09/10. Drawn with the
 * Dark Knight's helms he wore another man's head.
 */
const DARK_LORD_MASK_HELMS = [0, 5, 6, 8, 9];

export function darkLordMaskModel(part: PartItem, charClass: CharacterClassNumber | undefined): string | null {
  if (charClass !== CharacterClassNumber.DarkLord && charClass !== CharacterClassNumber.LordEmperor) return null;
  if (part.group !== 7 || !DARK_LORD_MASK_HELMS.includes(part.num)) return null;
  return `MaskHelmMale${String(part.num + 1).padStart(2, '0')}.glb`;
}

export function rageFighterSetModel(part: PartItem, charClass: CharacterClassNumber | undefined): string | null {
  if (charClass !== CharacterClassNumber.RageFighter && charClass !== CharacterClassNumber.FistMaster) return null;
  const prefix = MONK_PARTS[part.group];
  const index = RAGE_FIGHTER_COMMON_SETS.indexOf(part.num);
  if (!prefix || index < 0) return null;
  return `${prefix}0${index + 1}.glb`;
}
