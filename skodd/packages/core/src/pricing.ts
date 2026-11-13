import { kr, eksMva, prosentAv, type Ore } from './money.ts';
import type { Dekkdimensjon, Kjoretoy } from './regnr.ts';

export type PakkeId = 'skodd' | 'skodd_stor' | 'skodd_premium';

export interface Pakke {
  id: PakkeId;
  navn: string;
  /** Månedspris inkl. mva. */
  pris: Ore;
  passerFor: string;
  tommerFra: number;
  tommerTil: number;
  dekkvi: string;
}

/** Prisene fra konseptdokumentet. Inkl. mva, per bil, per måned. */
export const PAKKER: Record<PakkeId, Pakke> = {
  skodd: {
    id: 'skodd',
    navn: 'Skodd',
    pris: kr(399),
    passerFor: 'Småbil og mellomklasse, 15–17″',
    tommerFra: 15,
    tommerTil: 17,
    dekkvi: 'Kvalitetsmerke i mellomklassen',
  },
  skodd_stor: {
    id: 'skodd_stor',
    navn: 'Skodd Stor',
    pris: kr(549),
    passerFor: 'Elbil, SUV og varebil, 18–20″',
    tommerFra: 18,
    tommerTil: 20,
    dekkvi: 'Dekk laget for tunge elbiler',
  },
  skodd_premium: {
    id: 'skodd_premium',
    navn: 'Skodd Premium',
    pris: kr(799),
    passerFor: '20″+ og ytelsesbiler',
    tommerFra: 21,
    tommerTil: 24,
    dekkvi: 'Premiummerke, valgfritt pigg',
  },
};

export type TilleggId = 'felg_pluss' | 'vask_ved_skift' | 'over_15000_km';

export interface Tillegg {
  id: TilleggId;
  navn: string;
  pris: Ore;
  /** Månedlig tillegg, eller en gang per skift. */
  type: 'mnd' | 'per_skift';
  beskrivelse: string;
}

export const TILLEGG: Record<TilleggId, Tillegg> = {
  felg_pluss: {
    id: 'felg_pluss',
    navn: 'Felg+',
    pris: kr(49),
    type: 'mnd',
    beskrivelse: 'Dekker bøyd eller sprukket felg. Riper dekkes ikke.',
  },
  vask_ved_skift: {
    id: 'vask_ved_skift',
    navn: 'Vask ved skift',
    pris: kr(99),
    type: 'per_skift',
    beskrivelse: 'Utvendig vask mens vi har bilen.',
  },
  over_15000_km: {
    id: 'over_15000_km',
    navn: 'Over 15 000 km',
    pris: kr(100),
    type: 'mnd',
    beskrivelse: 'Kjører du mer enn 15 000 km i året, slites dekkene fortere.',
  },
};

export const VILKAR = {
  bindingManeder: 24,
  kmInkludertPerAr: 15_000,
  /** Rabatt for bil nummer to i samme husstand. */
  flerbilRabatt: 0.2,
  /** Depositum ved forhåndsbestilling. Gate 2 teller betalte depositum. */
  depositum: kr(399),
  /** Egenandel på ødelagt dekk etter det første inkluderte. */
  skadeEgenandel: kr(500),
  /** Ett ødelagt dekk er inkludert per 24 måneder. */
  inkluderteSkadedekkPerBinding: 1,
  /** Kunden kjøper eget sett til innkjøpspris pluss dette ved oppstart. */
  paslagVedOppstartskjop: 0.1,
  angrefristDager: 14,
} as const;

/** Pakke ut fra felgdiameter og biltype, slik tabellen i konseptet deler det inn. */
export function velgPakke(dim: Dekkdimensjon, type?: Kjoretoy['type']): Pakke {
  if (type === 'ytelsesbil') return PAKKER.skodd_premium;
  if (dim.tommer >= PAKKER.skodd_premium.tommerFra) return PAKKER.skodd_premium;
  if (dim.tommer >= PAKKER.skodd_stor.tommerFra) return PAKKER.skodd_stor;
  return PAKKER.skodd;
}

export interface TilbudInput {
  dimensjon: Dekkdimensjon;
  kjoretoytype?: Kjoretoy['type'];
  kmPerAr?: number;
  tillegg?: TilleggId[];
  /** Bil nummer to eller mer i husstanden. */
  flerbil?: boolean;
  /** Kampanjekode fra nabo eller borettslag. */
  kampanje?: Kampanje | null;
}

export interface Tilbudslinje {
  navn: string;
  belop: Ore;
  type: 'mnd' | 'per_skift' | 'rabatt';
}

export interface Tilbud {
  pakke: Pakke;
  linjer: Tilbudslinje[];
  /** Det kunden betaler hver måned, inkl. mva. */
  manedspris: Ore;
  manedsprisEksMva: Ore;
  arspris: Ore;
  depositum: Ore;
  bindingManeder: number;
  gratisManeder: number;
}

export interface Kampanje {
  kode: string;
  gratisManeder: number;
  kilde: 'nabo' | 'borettslag' | 'arbeidsplass' | 'annet';
}

/** Pris på ti sekunder, som kundereisen krever. */
export function lagTilbud(input: TilbudInput): Tilbud {
  const pakke = velgPakke(input.dimensjon, input.kjoretoytype);
  const linjer: Tilbudslinje[] = [{ navn: pakke.navn, belop: pakke.pris, type: 'mnd' }];

  const tilleggValgt = new Set(input.tillegg ?? []);
  if ((input.kmPerAr ?? 0) > VILKAR.kmInkludertPerAr) tilleggValgt.add('over_15000_km');

  for (const id of tilleggValgt) {
    const t = TILLEGG[id];
    linjer.push({ navn: t.navn, belop: t.pris, type: t.type });
  }

  let manedspris = linjer
    .filter((l) => l.type === 'mnd')
    .reduce((sum, l) => sum + l.belop, 0);

  if (input.flerbil) {
    const rabatt = -prosentAv(manedspris, VILKAR.flerbilRabatt);
    linjer.push({ navn: 'Bil nummer to i husstanden', belop: rabatt, type: 'rabatt' });
    manedspris += rabatt;
  }

  return {
    pakke,
    linjer,
    manedspris,
    manedsprisEksMva: eksMva(manedspris),
    arspris: manedspris * 12,
    depositum: VILKAR.depositum,
    bindingManeder: VILKAR.bindingManeder,
    gratisManeder: input.kampanje?.gratisManeder ?? 0,
  };
}

/**
 * Hovedbudskapet i salget: sammenligning mot å gjøre det selv.
 * Tallene er anslagene fra konseptet og må verifiseres i piloten.
 */
export interface Sammenligning {
  dekkhotellPerAr: Ore;
  dekkslitasjePerAr: Ore;
  dagensKostnadPerAr: Ore;
  skoddPerAr: Ore;
  differanse: Ore;
  skoddErBilligere: boolean;
}

export function sammenlignMedIDag(
  tilbud: Tilbud,
  anslag: { dekkhotellPerAr?: Ore; settPris?: Ore; arPerSett?: number } = {},
): Sammenligning {
  const dekkhotell = anslag.dekkhotellPerAr ?? kr(2500);
  // Ett sett koster 6-10 000 kr og varer fire sesonger. Bilen trenger to sett.
  const settPris = anslag.settPris ?? kr(7000);
  const arPerSett = anslag.arPerSett ?? 4;
  const slitasje = Math.round((settPris * 2) / arPerSett);
  const dagens = dekkhotell + slitasje;
  return {
    dekkhotellPerAr: dekkhotell,
    dekkslitasjePerAr: slitasje,
    dagensKostnadPerAr: dagens,
    skoddPerAr: tilbud.arspris,
    differanse: dagens - tilbud.arspris,
    skoddErBilligere: dagens > tilbud.arspris,
  };
}

/**
 * Utkjøp ved oppsigelse før bindingstiden er ute: restverdien av de dekkene
 * vi har kjøpt til kunden, ikke de kunden kom med selv.
 */
export function utkjopRestverdi(
  sett: { viKjopte: boolean; innkjopsprisEksMva: Ore; brukteSesonger: number; levetidSesonger: number }[],
): Ore {
  return sett
    .filter((s) => s.viKjopte)
    .reduce((sum, s) => {
      const igjen = Math.max(0, s.levetidSesonger - s.brukteSesonger) / s.levetidSesonger;
      return sum + Math.round(s.innkjopsprisEksMva * igjen);
    }, 0);
}
