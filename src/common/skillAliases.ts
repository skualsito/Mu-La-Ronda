/**
 * The Dark Lord's master-level numbers (OpenMU 508-523) and the base skill each one
 * strengthens. The original lists a strengthened skill in its base skill's `case`, so it
 * shares the clip, the effect, the sound and the light (ZzzCharacter.cpp:4366-4369,
 * WSclient.cpp:5242-5272). Store-free, so the clip, sound and light tables can resolve
 * through it as the visuals do. 510 / 513 are passives and 521 has its own row.
 */
export const DARK_LORD_MASTER_ALIASES: Readonly<Record<number, number>> = {
  508: 61, 509: 66, 511: 64, 512: 62, 514: 61, 515: 64, 516: 62, 517: 64, 518: 78, 519: 65, 520: 78, 522: 64, 523: 238,
};

/**
 * The Magic Gladiator's master-level numbers (OpenMU 479-496) and the base skill each one
 * strengthens: the original's SKILL_REPLACEMENTS (_enum.h:637-707) casts, draws, sounds and
 * lights them as the base skill. 492-494 and 496 are OpenMU-only and map by name.
 */
export const MAGIC_GLADIATOR_MASTER_ALIASES: Readonly<Record<number, number>> = {
  479: 22, 480: 3, 481: 41, 482: 56, 483: 5, 484: 13, 486: 14, 487: 9, 489: 7, 490: 55, 491: 7, 492: 236, 493: 55, 494: 236, 496: 237,
};

/** The base skill a master-level number borrows its clip, sound and light from, else the skill itself. */
export function masterBase(skill: number): number {
  return DARK_LORD_MASTER_ALIASES[skill] ?? MAGIC_GLADIATOR_MASTER_ALIASES[skill] ?? skill;
}

/**
 * Mu La Ronda: the skill each active master skill replaces when its first
 * point goes in - OpenMU's `MasterSkillDefinition.ReplacedSkill`
 * (VersionSeasonSix/SkillsInitializer.cs, the `regularSkill` argument of
 * every `AddMasterSkillDefinition`). A Mastery replaces its Strengthener,
 * which replaces the base skill. The server gives the master skill the
 * replaced skill's type, target and area settings, so the client casts it
 * the same way (`skillsDatabase`), and the tree asks for exactly this skill
 * before the first point (`masterTree.masterBaseSkillMet`).
 */
export const MASTER_REPLACES: Readonly<Record<number, number>> = {
  326: 22, 327: 23, 328: 19, 329: 20, 330: 41, 331: 42, 332: 330, 333: 331, 336: 43, 337: 232, 356: 48, 360: 356,
  378: 5, 379: 3, 380: 233, 381: 14, 382: 13, 383: 380, 384: 1, 385: 9, 387: 38, 388: 10, 389: 7, 403: 16,
  404: 403, 413: 26, 414: 24, 416: 52, 417: 27, 418: 414, 420: 28, 422: 420, 423: 417, 424: 51, 441: 77, 454: 219,
  455: 215, 456: 230, 458: 214, 469: 218, 470: 469, 479: 22, 480: 3, 481: 41, 482: 56, 483: 5, 484: 13, 486: 14,
  487: 9, 489: 7, 490: 55, 508: 61, 509: 66, 511: 64, 512: 62, 514: 508, 515: 511, 516: 512, 517: 515, 518: 78,
  551: 260, 552: 261, 554: 551, 555: 552, 558: 262, 559: 263, 560: 264, 569: 268, 572: 569, 573: 267,
};

/** The base skill at the end of the replacement chain (332 -> 330 -> 41), else the skill itself. */
export function masterRoot(skill: number): number {
  let n = skill;
  for (let i = 0; i < 4 && MASTER_REPLACES[n] !== undefined; i++) n = MASTER_REPLACES[n];
  return n;
}
