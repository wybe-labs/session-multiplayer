import { randomUUID } from 'node:crypto';
export const nyId = (): string => randomUUID();

/** Kampanjekode kunden kan lese opp til naboen. Ingen forvekslebare tegn. */
const TEGN = 'ACDEFGHJKLMNPQRTUVWXY349';
export function nyKampanjekode(lengde = 6): string {
  const bytes = new Uint8Array(lengde);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEGN[b % TEGN.length]).join('');
}
