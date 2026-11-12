/**
 * Innlogging med engangskode på SMS. BankID er riktig senere, men for en
 * pilot er mobilnummeret identiteten: det er allikevel det vi ringer.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from './db/client.ts';
import { engangskoder, kunder } from './db/schema.ts';
import { nyId } from './ids.ts';

export type Rolle = 'kunde' | 'montor' | 'ops';

export interface Token {
  kundeId: string;
  telefon: string;
  rolle: Rolle;
}

const KODE_LEVETID_MS = 5 * 60 * 1000;
const MAKS_FORSOK = 5;

export const hashKode = (kode: string, telefon: string, pepper: string): string =>
  createHash('sha256').update(`${telefon}:${kode}:${pepper}`).digest('hex');

export const lagKode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

export async function lagreKode(
  db: Db, telefon: string, kode: string, pepper: string, na = new Date(),
): Promise<void> {
  const rad = {
    telefon,
    kodeHash: hashKode(kode, telefon, pepper),
    utloper: new Date(na.getTime() + KODE_LEVETID_MS),
    forsok: 0,
  };
  await db.insert(engangskoder).values(rad).onConflictDoUpdate({
    target: engangskoder.telefon,
    set: { kodeHash: rad.kodeHash, utloper: rad.utloper, forsok: 0 },
  });
}

export type Bekreftelse =
  | { ok: true; kundeId: string; rolle: Rolle; nyKunde: boolean }
  | { ok: false; grunn: 'ingen_kode' | 'utlopt' | 'feil_kode' | 'for_mange_forsok' };

export async function bekreftKode(
  db: Db, telefon: string, kode: string, pepper: string, na = new Date(),
): Promise<Bekreftelse> {
  const [rad] = await db.select().from(engangskoder).where(eq(engangskoder.telefon, telefon));
  if (!rad) return { ok: false, grunn: 'ingen_kode' };
  if (rad.forsok >= MAKS_FORSOK) return { ok: false, grunn: 'for_mange_forsok' };
  if (rad.utloper < na) return { ok: false, grunn: 'utlopt' };

  const ventet = hashKode(kode, telefon, pepper);
  const likt =
    ventet.length === rad.kodeHash.length &&
    timingSafeEqual(Buffer.from(ventet), Buffer.from(rad.kodeHash));

  if (!likt) {
    await db.update(engangskoder).set({ forsok: rad.forsok + 1 })
      .where(eq(engangskoder.telefon, telefon));
    return { ok: false, grunn: 'feil_kode' };
  }

  await db.delete(engangskoder).where(eq(engangskoder.telefon, telefon));

  const [funnet] = await db.select().from(kunder).where(eq(kunder.telefon, telefon));
  if (funnet) return { ok: true, kundeId: funnet.id, rolle: funnet.rolle, nyKunde: false };

  const id = nyId();
  await db.insert(kunder).values({ id, telefon, rolle: 'kunde' });
  return { ok: true, kundeId: id, rolle: 'kunde', nyKunde: true };
}
