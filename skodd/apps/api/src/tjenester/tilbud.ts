/** Pris på ti sekunder: regnr inn, tilbud ut. */
import {
  lagTilbud, sammenlignMedIDag, velgPakke, type Kjoretoy, type Tilbud, type Sammenligning,
  type TilleggId, type Kampanje,
} from '@skodd/core';
import { eq } from 'drizzle-orm';
import type { Kjoretoyregister } from '../adapters/index.ts';
import type { Db } from '../db/client.ts';
import { kampanjekoder } from '../db/schema.ts';

export interface TilbudSvar {
  kjoretoy: Kjoretoy;
  tilbud: Tilbud;
  sammenligning: Sammenligning;
  kampanje: Kampanje | null;
}

export async function hentKampanje(db: Db, kode?: string): Promise<Kampanje | null> {
  if (!kode) return null;
  const normalisert = kode.trim().toUpperCase();
  const [rad] = await db.select().from(kampanjekoder).where(eq(kampanjekoder.kode, normalisert));
  if (!rad || !rad.aktiv) return null;
  if (rad.maksBruk !== null && rad.bruktAntall >= rad.maksBruk) return null;
  return { kode: rad.kode, gratisManeder: rad.gratisManeder, kilde: rad.kilde };
}

export async function lagTilbudFor(
  register: Kjoretoyregister,
  db: Db,
  input: { regnr: string; kmPerAr?: number; tillegg?: TilleggId[]; flerbil?: boolean; kampanjekode?: string },
): Promise<TilbudSvar | null> {
  const kjoretoy = await register.slaOpp(input.regnr);
  if (!kjoretoy) return null;

  const kampanje = await hentKampanje(db, input.kampanjekode);
  const tilbud = lagTilbud({
    dimensjon: kjoretoy.dimensjonFor,
    kjoretoytype: kjoretoy.type,
    ...(input.kmPerAr !== undefined ? { kmPerAr: input.kmPerAr } : {}),
    ...(input.tillegg ? { tillegg: input.tillegg } : {}),
    ...(input.flerbil !== undefined ? { flerbil: input.flerbil } : {}),
    kampanje,
  });

  return { kjoretoy, tilbud, sammenligning: sammenlignMedIDag(tilbud), kampanje };
}

export { velgPakke };
