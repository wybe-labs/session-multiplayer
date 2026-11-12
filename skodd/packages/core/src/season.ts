/**
 * Sesonglogikk for norske dekk.
 *
 * Piggdekk er lov fra 1. november til og med første mandag etter 2. påskedag.
 * I Nordland, Troms og Finnmark gjelder 16. oktober til 30. april.
 * Kilde: konseptdokumentet (Clas Ohlson / Statens vegvesen).
 */
export type Sesong = 'vinter' | 'sommer';
export type Region = 'sor' | 'nord';

export const NORD_FYLKER = ['Nordland', 'Troms', 'Finnmark', 'Troms og Finnmark'] as const;

const DAG = 86_400_000;

const utc = (ar: number, maned1: number, dag: number): Date =>
  new Date(Date.UTC(ar, maned1 - 1, dag));

/** Påskedag (søndag) etter den anonyme gregorianske algoritmen. */
export function paskedag(ar: number): Date {
  const a = ar % 19;
  const b = Math.floor(ar / 100);
  const c = ar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ar, maned, dag);
}

/** 2. påskedag: mandagen etter påskedag. */
export const andrePaskedag = (ar: number): Date => new Date(paskedag(ar).getTime() + DAG);

/** Siste lovlige dag med pigg: første mandag etter 2. påskedag. */
export const piggfrist = (ar: number, region: Region = 'sor'): Date =>
  region === 'nord' ? utc(ar, 4, 30) : new Date(andrePaskedag(ar).getTime() + 7 * DAG);

/** Første lovlige dag med pigg om høsten. */
export const piggstart = (ar: number, region: Region = 'sor'): Date =>
  region === 'nord' ? utc(ar, 10, 16) : utc(ar, 11, 1);

export function piggErLov(dato: Date, region: Region = 'sor'): boolean {
  const ar = dato.getUTCFullYear();
  return dato <= piggfrist(ar, region) || dato >= piggstart(ar, region);
}

/** Hvilket sett som skal stå på bilen nå. */
export function sesongFor(dato: Date, region: Region = 'sor'): Sesong {
  return piggErLov(dato, region) ? 'vinter' : 'sommer';
}

/** Aksentfargen i merkevaren følger sesongen: Is okt-mars, Sol april-sept. */
export const aksentSesong = (dato: Date): 'is' | 'sol' => {
  const m = dato.getUTCMonth() + 1;
  return m >= 10 || m <= 3 ? 'is' : 'sol';
};

export interface SkiftVindu {
  sesong: Sesong;
  /** Settet som monteres i dette vinduet. */
  monterer: Sesong;
  start: Date;
  slutt: Date;
  /** Frist satt av loven, ikke av oss. */
  lovpalagtFrist?: Date;
}

/**
 * De to skiftvinduene i et år. Seks uker hver, slik risikotabellen i
 * konseptet krever, med vårvinduet lagt slik at det ender på piggfristen.
 */
export function skiftvinduer(ar: number, region: Region = 'sor'): [SkiftVindu, SkiftVindu] {
  const frist = piggfrist(ar, region);
  const var_ = {
    sesong: 'sommer' as Sesong,
    monterer: 'sommer' as Sesong,
    start: new Date(frist.getTime() - 35 * DAG),
    slutt: new Date(frist.getTime() + 7 * DAG),
    lovpalagtFrist: frist,
  };
  const start = piggstart(ar, region);
  const host = {
    sesong: 'vinter' as Sesong,
    monterer: 'vinter' as Sesong,
    start: new Date(start.getTime() - 21 * DAG),
    slutt: new Date(start.getTime() + 21 * DAG),
    lovpalagtFrist: start,
  };
  return [var_, host];
}

/** Neste skiftvindu etter en gitt dato. */
export function nesteVindu(fra: Date, region: Region = 'sor'): SkiftVindu {
  const ar = fra.getUTCFullYear();
  const kandidater = [...skiftvinduer(ar, region), ...skiftvinduer(ar + 1, region)];
  const treff = kandidater.find((v) => v.slutt >= fra);
  return treff ?? kandidater[kandidater.length - 1]!;
}

/**
 * Neste skift for en bestemt bil: første vindu som monterer det settet som
 * ikke står på bilen. En bil som alt har fått vinterdekkene på i høstvinduet
 * skal se vårvinduet, ikke det vinduet den nettopp er ferdig med.
 */
export function nesteVinduFor(paBil: Sesong, fra: Date, region: Region = 'sor'): SkiftVindu {
  const ar = fra.getUTCFullYear();
  const kandidater = [
    ...skiftvinduer(ar, region),
    ...skiftvinduer(ar + 1, region),
    ...skiftvinduer(ar + 2, region),
  ];
  const treff = kandidater.find((v) => v.slutt >= fra && v.monterer !== paBil);
  return treff ?? kandidater[kandidater.length - 1]!;
}

export const dagerTil = (dato: Date, fra: Date = new Date()): number =>
  Math.ceil((dato.getTime() - fra.getTime()) / DAG);
