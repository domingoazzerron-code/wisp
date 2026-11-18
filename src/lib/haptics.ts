// Haptics (legacy buzz). `buzzPattern` is pure; `buzz` is the thin browser wrapper.

export type BuzzKind = 'tap' | 'strong' | 'heal' | number;

/** Vibration pattern (ms on/off pairs). A numeric kind is a Wisp level 0..6: higher = more and stronger pulses. */
export function buzzPattern(kind: BuzzKind): number[] {
  if (kind === 'tap') return [10];
  if (kind === 'strong') return [38, 55, 38];
  if (kind === 'heal') return [30, 70, 30];
  const n = 1 + Math.floor(kind / 2);
  const p: number[] = [];
  for (let i = 0; i < n; i++) p.push(22 + kind * 12, 40);
  return p;
}
