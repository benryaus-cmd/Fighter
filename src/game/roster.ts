/** Models supplied by the project owner, and attributed in ASSET_CREDITS.md. */
export const ROSTER = [
  { id: 'cat', name: 'CAT GIRL', file: 'cat-girl.glb' },
  { id: 'cute', name: 'CUTE GIRL', file: 'cute-anime-girl.glb' },
  { id: 'nieko', name: 'NIEKO', file: 'nieko.glb' },
  { id: 'mei', name: 'MEI TACHIBANA', file: 'mei-tachibana.glb' },
  { id: 'base', name: 'ANIME GIRL', file: 'anime-girl-base.glb' },
] as const;
export type RosterFighter = typeof ROSTER[number];
/** Pick two distinct fighters for every new match. Exposed for deterministic tests. */
export function chooseFighters(random: () => number = Math.random): readonly [RosterFighter, RosterFighter] {
  const i = Math.min(ROSTER.length - 1, Math.max(0, Math.floor(random() * ROSTER.length)));
  const j = Math.min(ROSTER.length - 2, Math.max(0, Math.floor(random() * (ROSTER.length - 1))));
  return [ROSTER[i], ROSTER[j >= i ? j + 1 : j]];
}
