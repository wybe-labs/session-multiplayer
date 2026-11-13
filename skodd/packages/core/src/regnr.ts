/** Registreringsnummer og dekkdimensjon. Hele kundereisen starter her. */

export class UgyldigRegnr extends Error {
  constructor(public readonly input: string) {
    super(`Ugyldig registreringsnummer: ${input}`);
    this.name = 'UgyldigRegnr';
  }
}

/** To bokstaver og fem siffer. I og Q brukes ikke på norske skilt. */
const REGNR = /^[A-HJ-NPR-TV-Z]{2}\d{5}$/;

export function normaliserRegnr(input: string): string {
  const rent = input.toUpperCase().replace(/[\s-]/g, '');
  if (!REGNR.test(rent)) throw new UgyldigRegnr(input);
  return rent;
}

export const erGyldigRegnr = (input: string): boolean => {
  try {
    normaliserRegnr(input);
    return true;
  } catch {
    return false;
  }
};

/** Vises som AB 12345, slik skiltet ser ut. */
export const visRegnr = (regnr: string): string =>
  `${regnr.slice(0, 2)} ${regnr.slice(2)}`;

export interface Dekkdimensjon {
  /** Bredde i mm, f.eks. 225. */
  bredde: number;
  /** Profil i prosent av bredden, f.eks. 45. */
  profil: number;
  /** Felgdiameter i tommer, f.eks. 18. */
  tommer: number;
  lastindeks?: number;
  hastighetsindeks?: string;
}

const DIM = /^(\d{3})\s*\/\s*(\d{2})\s*[RZ]+\s*(\d{2})(?:\s+(\d{2,3})\s*([A-Z]{1,2}))?$/i;

/** Parser «225/45R18 95Y» slik Vegvesenet oppgir det. */
export function parseDimensjon(input: string): Dekkdimensjon {
  const m = DIM.exec(input.trim());
  if (!m) throw new Error(`Kan ikke tolke dekkdimensjon: ${input}`);
  const dim: Dekkdimensjon = {
    bredde: Number(m[1]),
    profil: Number(m[2]),
    tommer: Number(m[3]),
  };
  if (m[4]) dim.lastindeks = Number(m[4]);
  if (m[5]) dim.hastighetsindeks = m[5].toUpperCase();
  return dim;
}

export const visDimensjon = (d: Dekkdimensjon): string =>
  `${d.bredde}/${d.profil}R${d.tommer}${d.lastindeks ? ` ${d.lastindeks}${d.hastighetsindeks ?? ''}` : ''}`;

export type Kjoretoytype = 'personbil' | 'suv' | 'varebil' | 'ytelsesbil';
export type Drivstoff = 'elektrisk' | 'hybrid' | 'bensin' | 'diesel' | 'annet';

/** Det vi trenger å vite om bilen for å gi pris. */
export interface Kjoretoy {
  regnr: string;
  merke: string;
  modell: string;
  arsmodell: number;
  type: Kjoretoytype;
  drivstoff: Drivstoff;
  /** Egenvekt i kg. Tunge elbiler sliter fortere på dekkene. */
  vektKg?: number;
  dimensjonFor: Dekkdimensjon;
  /** Vinterdimensjon er ofte en tomme mindre. */
  dimensjonBak?: Dekkdimensjon;
}
