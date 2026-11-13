/**
 * Enhetsøkonomi per bil per år.
 *
 * Konseptet anslår ca. 26 % bidragsmargin ved full dekkslitasje. Modellen
 * her er den samme regnestykket med navngitte poster, slik at tallene kan
 * erstattes med målte verdier fra piloten etter hvert som de kommer inn.
 */
import { eksMva, kr, type Ore } from './money.ts';
import { PAKKER, type PakkeId } from './pricing.ts';

export interface Forutsetninger {
  /** Innkjøpspris per sett eks. mva. Konseptet anslår 3 500 kr. */
  settInnkjopEksMva: Ore;
  /** Sesonger et sett varer. Konseptet anslår fire. */
  levetidSesonger: number;
  /** Vår kostnad per utført skift. Konseptet anslår 250 kr på tett rute. */
  kostnadPerSkift: Ore;
  /** Leie av hyllemeter per bil per år (to sett). */
  lagerPerAr: Ore;
  /** Avsetning til punktering og det inkluderte skadedekket. */
  skadeavsetningPerAr: Ore;
  /** Kortgebyr og fakturakostnad, andel av brutto. */
  betalingsandel: number;
  /** Kundeservice og administrasjon per bil per år. */
  supportPerAr: Ore;
  skiftPerAr: number;
}

export const STANDARD_FORUTSETNINGER: Forutsetninger = {
  settInnkjopEksMva: kr(3500),
  levetidSesonger: 4,
  kostnadPerSkift: kr(250),
  lagerPerAr: kr(200),
  skadeavsetningPerAr: kr(250),
  betalingsandel: 0.024,
  supportPerAr: kr(100),
  skiftPerAr: 2,
};

export interface Kostnadslinje {
  navn: string;
  belop: Ore;
}

export interface Enhetsokonomi {
  pakke: PakkeId;
  inntektEksMva: Ore;
  kostnader: Kostnadslinje[];
  sumKostnader: Ore;
  bidrag: Ore;
  bidragsmargin: number;
}

/**
 * Full slitasje: begge sett er kjøpt av oss og slites ned over levetiden.
 * Første år er marginen høyere, fordi kunden tar med egne dekk.
 */
export function enhetsokonomi(
  pakke: PakkeId = 'skodd',
  f: Forutsetninger = STANDARD_FORUTSETNINGER,
  opts: { kundensEgneDekk?: boolean } = {},
): Enhetsokonomi {
  const brutto = PAKKER[pakke].pris * 12;
  const inntekt = eksMva(brutto);

  // To sett per bil. Hvert sett brukes én sesong i året, og varer
  // levetidSesonger sesonger, altså like mange år.
  const dekkPerAr = opts.kundensEgneDekk
    ? 0
    : Math.round((f.settInnkjopEksMva * 2) / f.levetidSesonger);

  const kostnader: Kostnadslinje[] = [
    { navn: 'Dekkslitasje, to sett', belop: dekkPerAr },
    { navn: 'Skift', belop: f.kostnadPerSkift * f.skiftPerAr },
    { navn: 'Lagerleie', belop: f.lagerPerAr },
    { navn: 'Skade og punktering', belop: f.skadeavsetningPerAr },
    { navn: 'Betalingskostnad', belop: Math.round(brutto * f.betalingsandel) },
    { navn: 'Support og admin', belop: f.supportPerAr },
  ];

  const sum = kostnader.reduce((s, k) => s + k.belop, 0);
  return {
    pakke,
    inntektEksMva: inntekt,
    kostnader,
    sumKostnader: sum,
    bidrag: inntekt - sum,
    bidragsmargin: (inntekt - sum) / inntekt,
  };
}

/** Årlig inntekt eks. mva. ved et gitt antall biler. Brukes i skaleringstallene. */
export const arligInntektEksMva = (biler: number, pakke: PakkeId = 'skodd'): Ore =>
  eksMva(PAKKER[pakke].pris) * 12 * biler;

export interface Pilotbudsjett {
  linjer: Kostnadslinje[];
  sum: Ore;
  arligAbonnementInklMva: Ore;
}

/** Pilotbudsjettet fra konseptet: 300 biler, våren 2027, ca. 385 000 kr. */
export function pilotbudsjett(biler = 300, pakke: PakkeId = 'skodd'): Pilotbudsjett {
  const linjer: Kostnadslinje[] = [
    { navn: 'Leasing av to varebiler i to måneder', belop: kr(60_000) },
    { navn: `Montører, ${biler} skift`, belop: kr(75_000) },
    { navn: `Leie av lager for ${biler} sett i ett år`, belop: kr(60_000) },
    { navn: 'Markedsføring og innhold', belop: kr(50_000) },
    { navn: 'Verktøy, forsikring og juridisk gjennomgang', belop: kr(40_000) },
    { navn: 'Buffer til dekkinnkjøp', belop: kr(100_000) },
  ];
  return {
    linjer,
    sum: linjer.reduce((s, l) => s + l.belop, 0),
    arligAbonnementInklMva: PAKKER[pakke].pris * 12 * biler,
  };
}
