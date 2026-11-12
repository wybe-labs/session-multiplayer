/**
 * Ruteplanlegging og kapasitet.
 *
 * Tetthet er det som gjør et skift billig. Modellen her viser hvorfor
 * borettslag og arbeidsplasser er kanalen, og brukes av driftsverktøyet
 * til å måle kostnad per skift mot Gate 3 (≤ 300 kr).
 */
import { kr, type Ore } from './money.ts';

export type Stedstype = 'borettslag' | 'arbeidsplass' | 'hjemme' | 'garasjeanlegg';

export interface Sted {
  id: string;
  navn: string;
  type: Stedstype;
  adresse: string;
  /** For rutestrekk. Ikke påkrevd for prising. */
  lat?: number;
  lon?: number;
}

export interface Jobb {
  id: string;
  stedId: string;
  abonnementId: string;
  regnr: string;
  /** Monterer vi sommer- eller vintersettet. */
  monterer: 'sommer' | 'vinter';
  /** Settet som skal tas med tilbake til lageret. */
  henterSett: boolean;
  tilleggVask?: boolean;
}

export const DRIFTSANSLAG = {
  /** Akkordlønn, midt i spennet Noddi annonserer (250-350 kr/t). */
  montorTimeprisOre: kr(320),
  /** Leasing, drivstoff og forsikring per varebil per arbeidsdag. */
  varebilPerDagOre: kr(1000),
  /** Minutter per hjulskift når flere biler står samlet. */
  minutterSamlet: 20,
  /** Minutter per bil når vi kjører til én adresse. */
  minutterEnkelt: 35,
  /** Reisetid mellom to steder. */
  minutterMellomSteder: 20,
  /** Effektiv arbeidsdag. */
  minutterPerDag: 420,
  vaskMinutter: 8,
} as const;

export const minutterForJobb = (antallPaStedet: number, vask = false): number =>
  (antallPaStedet >= 3 ? DRIFTSANSLAG.minutterSamlet : DRIFTSANSLAG.minutterEnkelt) +
  (vask ? DRIFTSANSLAG.vaskMinutter : 0);

export interface Rute {
  dato: Date;
  montorId?: string;
  stopp: { sted: Sted; jobber: Jobb[]; minutter: number }[];
  totaltMinutter: number;
  antallJobber: number;
  kostnadOre: Ore;
  kostnadPerSkiftOre: Ore;
  overKapasitet: boolean;
}

/**
 * Grupperer jobber per sted og legger dem etter størrelse, største først.
 * Enkel og god nok: tetthet betyr mer enn optimal rekkefølge.
 */
export function planleggRute(
  jobber: Jobb[],
  steder: Sted[],
  dato: Date,
  montorId?: string,
): Rute {
  const stedMap = new Map(steder.map((s) => [s.id, s]));
  const grupper = new Map<string, Jobb[]>();
  for (const j of jobber) {
    const liste = grupper.get(j.stedId) ?? [];
    liste.push(j);
    grupper.set(j.stedId, liste);
  }

  const stopp = [...grupper.entries()]
    .map(([stedId, jobberPaSted]) => {
      const sted = stedMap.get(stedId);
      if (!sted) throw new Error(`Ukjent sted: ${stedId}`);
      const minutter = jobberPaSted.reduce(
        (sum, j) => sum + minutterForJobb(jobberPaSted.length, j.tilleggVask),
        0,
      );
      return { sted, jobber: jobberPaSted, minutter };
    })
    .sort((a, b) => b.jobber.length - a.jobber.length);

  const reise = Math.max(0, stopp.length - 1) * DRIFTSANSLAG.minutterMellomSteder;
  const totaltMinutter = stopp.reduce((s, x) => s + x.minutter, 0) + reise;
  const antallJobber = jobber.length;

  const dagsandel = totaltMinutter / DRIFTSANSLAG.minutterPerDag;
  const kostnadOre =
    Math.round((totaltMinutter / 60) * DRIFTSANSLAG.montorTimeprisOre) +
    Math.round(dagsandel * DRIFTSANSLAG.varebilPerDagOre);

  const rute: Rute = {
    dato,
    stopp,
    totaltMinutter,
    antallJobber,
    kostnadOre,
    kostnadPerSkiftOre: antallJobber === 0 ? 0 : Math.round(kostnadOre / antallJobber),
    overKapasitet: totaltMinutter > DRIFTSANSLAG.minutterPerDag,
  };
  if (montorId) rute.montorId = montorId;
  return rute;
}

/** Gate 3 i planen: kostnad per skift skal ned til 300 kr eller lavere. */
export const GATE3_KOSTNAD_PER_SKIFT = kr(300);
export const bestarGate3 = (rute: Rute): boolean =>
  rute.kostnadPerSkiftOre > 0 && rute.kostnadPerSkiftOre <= GATE3_KOSTNAD_PER_SKIFT;

export interface Kapasitet {
  montorer: number;
  arbeidsdager: number;
  /** Hvor mange biler vi klarer, gitt snitt antall biler per sted. */
  maksBiler: number;
  jobberPerDagPerMontor: number;
}

export function kapasitet(
  montorer: number,
  arbeidsdager: number,
  snittBilerPerSted = 8,
): Kapasitet {
  const perJobb = minutterForJobb(snittBilerPerSted);
  const stederPerDag = Math.max(1, Math.floor(DRIFTSANSLAG.minutterPerDag / (perJobb * snittBilerPerSted + DRIFTSANSLAG.minutterMellomSteder)));
  const jobberPerDag = Math.min(
    Math.floor(DRIFTSANSLAG.minutterPerDag / perJobb),
    stederPerDag * snittBilerPerSted,
  );
  return {
    montorer,
    arbeidsdager,
    jobberPerDagPerMontor: jobberPerDag,
    maksBiler: jobberPerDag * montorer * arbeidsdager,
  };
}
