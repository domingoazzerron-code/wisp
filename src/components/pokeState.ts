import { newPokeState, pokeReply, POKE_SHOW_MS } from '../lib/reactions.ts';

// Poke state lives here, not in the saved state (legacy: module variables pokeTxt, pokeUntil, pokeN, ...).
const st = newPokeState();
let text = '';
let until = 0;

/** Picks a reply for a poke at `now` and remembers it for 7 s. */
export function doPoke(lines: readonly string[], now: number = Date.now(), rnd: () => number = Math.random): void {
  text = pokeReply(st, lines, now, rnd);
  until = now + POKE_SHOW_MS;
}

export function getPoke(): { text: string; until: number } {
  return { text, until };
}

/** Clears the visible poke line (legacy pokeUntil=0 so a celebration caption can show). */
export function clearPoke(): void {
  text = '';
  until = 0;
}
