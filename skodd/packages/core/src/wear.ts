/**
 * Mønsterdybde, slitasje og prognose.
 *
 * Dette er den viktigste datafangsten i Skodd. Hvert skift gir målt mønster
 * på fire hjul, kjørelengde og dato. Av det kan vi regne slitasje per 1000 km
 * for en bestemt bil, forutsi når den trenger nye dekk, og prise riktig.
 */
import type { Sesong } from './season.ts';

/** Norsk desimaltegn. Tall vises med komma overalt i produktet. */
export const mmTekst = (mm: number): string => mm.toFixed(1).replace('.', ',');

export type Hjulposisjon = 'VF' | 'HF' | 'VB' | 'HB';
export const HJUL: Hjulposisjon[] = ['VF', 'HF', 'VB', 'HB'];

export const HJULNAVN: Record<Hjulposisjon, string> = {
  VF: 'Venstre foran',
  HF: 'Høyre foran',
  VB: 'Venstre bak',
  HB: 'Høyre bak',
};

/** Tre punkter per dekk: innerkant, midten, ytterkant. Avdekker skjev slitasje. */
export interface HjulMaling {
  posisjon: Hjulposisjon;
  innerMm: number;
  midtMm: number;
  ytterMm: number;
}

export interface Maling {
  id?: string;
  dekksettId: string;
  /** Kilometerstand ved målingen. */
  kmStand: number;
  maltDato: Date;
  hjul: HjulMaling[];
  /** Montørens initialer eller id. */
  maltAv?: string;
  bildeUrler?: string[];
}

/** Lovkrav i Norge. Vinterdekk 3,0 mm, sommerdekk 1,6 mm. */
export const LOVLIG_MIN_MM: Record<Sesong, number> = { vinter: 3.0, sommer: 1.6 };

/** Vår egen grense. Vi skifter før kunden kommer nær lovkravet. */
export const SKODD_GRENSE_MM: Record<Sesong, number> = { vinter: 4.5, sommer: 3.0 };

/** Mønster på nye dekk. Utgangspunkt for slitasjeberegning. */
export const NYTT_MM: Record<Sesong, number> = { vinter: 8.5, sommer: 8.0 };

export const minMm = (m: HjulMaling): number => Math.min(m.innerMm, m.midtMm, m.ytterMm);

export const hjulSnittMm = (m: HjulMaling): number =>
  (m.innerMm + m.midtMm + m.ytterMm) / 3;

/** Settets tilstand styres av det svakeste hjulet, ikke av snittet. */
export const settMinMm = (maling: Maling): number =>
  Math.min(...maling.hjul.map(minMm));

export const settSnittMm = (maling: Maling): number =>
  maling.hjul.reduce((s, h) => s + hjulSnittMm(h), 0) / maling.hjul.length;

/** Skjev slitasje over 1,5 mm tyder på feil trykk eller skjev framstilling. */
export const SKJEV_GRENSE_MM = 1.5;

export interface Avvik {
  posisjon: Hjulposisjon;
  type: 'skjev_slitasje' | 'under_lovlig' | 'under_var_grense';
  detalj: string;
}

export function finnAvvik(maling: Maling, sesong: Sesong): Avvik[] {
  const avvik: Avvik[] = [];
  for (const h of maling.hjul) {
    const spenn = Math.max(h.innerMm, h.midtMm, h.ytterMm) - minMm(h);
    if (spenn >= SKJEV_GRENSE_MM) {
      avvik.push({
        posisjon: h.posisjon,
        type: 'skjev_slitasje',
        detalj: `${mmTekst(spenn)} mm forskjell over dekket. Sjekk trykk og framstilling.`,
      });
    }
    if (minMm(h) < LOVLIG_MIN_MM[sesong]) {
      avvik.push({
        posisjon: h.posisjon,
        type: 'under_lovlig',
        detalj: `${mmTekst(minMm(h))} mm er under lovkravet på ${mmTekst(LOVLIG_MIN_MM[sesong])} mm.`,
      });
    } else if (minMm(h) < SKODD_GRENSE_MM[sesong]) {
      avvik.push({
        posisjon: h.posisjon,
        type: 'under_var_grense',
        detalj: `${mmTekst(minMm(h))} mm. Settet byttes før neste sesong.`,
      });
    }
  }
  return avvik;
}

export interface Slitasjerate {
  /** Millimeter mønster tapt per 1000 km. */
  mmPer1000Km: number;
  /** Antall km målingene bygger på. Under 2000 km er raten usikker. */
  grunnlagKm: number;
  sikker: boolean;
}

/**
 * Slitasjerate fra to målinger på samme sett. Bruker minste mønster, fordi
 * det er det som avgjør når settet må byttes.
 */
export function slitasjerate(fra: Maling, til: Maling): Slitasjerate | null {
  const km = til.kmStand - fra.kmStand;
  const tapt = settMinMm(fra) - settMinMm(til);
  if (km <= 0) return null;
  const rate = Math.max(0, (tapt / km) * 1000);
  return { mmPer1000Km: rate, grunnlagKm: km, sikker: km >= 2000 && tapt > 0 };
}

/** Typiske rater når vi ennå ikke har to målinger på bilen. */
export const STANDARDRATE: Record<string, number> = {
  vinter_lett: 0.1,
  vinter_tung: 0.14,
  sommer_lett: 0.07,
  sommer_tung: 0.11,
};

export const standardrateFor = (sesong: Sesong, vektKg = 1600): number =>
  STANDARDRATE[`${sesong}_${vektKg >= 2000 ? 'tung' : 'lett'}`]!;

export interface Prognose {
  /** Mønster nå, minste måling på settet. */
  naMm: number;
  mmPer1000Km: number;
  /** Km igjen før vår egen grense. */
  kmIgjen: number;
  /** Sesonger settet holder, avrundet ned. */
  sesongerIgjen: number;
  /** Anslått dato for bytte, gitt kjørelengde per år. */
  byttesAnslag: Date;
  maBytteNa: boolean;
  /** Hvor mye av settets verdi som er brukt opp, 0-1. */
  brukt: number;
}

export interface PrognoseInput {
  sisteMaling: Maling;
  sesong: Sesong;
  rate?: Slitasjerate | null;
  kmPerAr?: number;
  vektKg?: number;
  /** Andel av året settet står på bilen. Et sesongsett kjører halve året. */
  andelAvAret?: number;
  na?: Date;
}

export function prognose(input: PrognoseInput): Prognose {
  const { sisteMaling, sesong } = input;
  const kmPerAr = input.kmPerAr ?? 15_000;
  const andel = input.andelAvAret ?? 0.5;
  const rate =
    input.rate?.sikker && input.rate.mmPer1000Km > 0
      ? input.rate.mmPer1000Km
      : standardrateFor(sesong, input.vektKg);

  const na = settMinMm(sisteMaling);
  const grense = SKODD_GRENSE_MM[sesong];
  const mmIgjen = Math.max(0, na - grense);
  const kmIgjen = Math.round((mmIgjen / rate) * 1000);
  const kmPerSesong = kmPerAr * andel;
  const sesongerIgjen = Math.floor(kmIgjen / kmPerSesong);

  const start = input.na ?? sisteMaling.maltDato;
  const arIgjen = kmIgjen / kmPerAr;
  const byttesAnslag = new Date(start.getTime() + arIgjen * 365.25 * 86_400_000);

  const spenn = NYTT_MM[sesong] - grense;
  const brukt = Math.min(1, Math.max(0, (NYTT_MM[sesong] - na) / spenn));

  return {
    naMm: na,
    mmPer1000Km: rate,
    kmIgjen,
    sesongerIgjen,
    byttesAnslag,
    maBytteNa: na <= grense,
    brukt,
  };
}

/**
 * Teksten kunden får på SMS etter et skift. Stemmen i merkevaren er rolig,
 * kort og tørr: «4,2 mm igjen. Godt for en sesong til.»
 */
export function monsterTekst(p: Prognose): string {
  const mm = mmTekst(p.naMm);
  if (p.maBytteNa) return `${mm} mm igjen. Vi bytter settet før neste sesong.`;
  if (p.sesongerIgjen <= 1) return `${mm} mm igjen. Holder sesongen ut.`;
  if (p.sesongerIgjen === 2) return `${mm} mm igjen. Godt for en sesong til.`;
  return `${mm} mm igjen. Godt for ${p.sesongerIgjen} sesonger til.`;
}
