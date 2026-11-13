/** De tre gatene i planen fram til vårskiftet 2027. Måles mot levende data. */
export type GateId = 'gate1' | 'gate2' | 'gate3';

export interface GateKrav {
  id: GateId;
  dato: Date;
  navn: string;
  krav: string;
  hvisIkke: string;
}

export const GATER: Record<GateId, GateKrav> = {
  gate1: {
    id: 'gate1',
    dato: new Date(Date.UTC(2027, 0, 15)),
    navn: 'Gate 1',
    krav: '150 reservasjoner og 3 borettslag som sier ja',
    hvisIkke: 'Endre pris eller kanal, ny test i fire uker',
  },
  gate2: {
    id: 'gate2',
    dato: new Date(Date.UTC(2027, 2, 15)),
    navn: 'Gate 2',
    krav: '100 betalte depositum og avtale med en lagerpartner',
    hvisIkke: 'Vi stopper og betaler tilbake depositumene',
  },
  gate3: {
    id: 'gate3',
    dato: new Date(Date.UTC(2027, 4, 14)),
    navn: 'Gate 3',
    krav: 'Kostnad per skift ≤ 300 kr, NPS ≥ 60, under 10 % vil si opp',
    hvisIkke: 'Vi justerer modellen før høstsesongen',
  },
};

export interface GateStatus {
  gate: GateKrav;
  malinger: { navn: string; verdi: number; mal: number; bestatt: boolean }[];
  bestatt: boolean;
}

export interface Noktall {
  reservasjoner: number;
  borettslagJa: number;
  betalteDepositum: number;
  harLagerpartner: boolean;
  kostnadPerSkiftOre: number;
  nps: number;
  oppsigelsesandel: number;
}

export function vurderGate(id: GateId, n: Noktall): GateStatus {
  const gate = GATER[id];
  const m: GateStatus['malinger'] =
    id === 'gate1'
      ? [
          { navn: 'Reservasjoner', verdi: n.reservasjoner, mal: 150, bestatt: n.reservasjoner >= 150 },
          { navn: 'Borettslag som sier ja', verdi: n.borettslagJa, mal: 3, bestatt: n.borettslagJa >= 3 },
        ]
      : id === 'gate2'
        ? [
            { navn: 'Betalte depositum', verdi: n.betalteDepositum, mal: 100, bestatt: n.betalteDepositum >= 100 },
            { navn: 'Lagerpartner', verdi: n.harLagerpartner ? 1 : 0, mal: 1, bestatt: n.harLagerpartner },
          ]
        : [
            { navn: 'Kostnad per skift (øre)', verdi: n.kostnadPerSkiftOre, mal: 30_000, bestatt: n.kostnadPerSkiftOre <= 30_000 },
            { navn: 'NPS', verdi: n.nps, mal: 60, bestatt: n.nps >= 60 },
            { navn: 'Andel som vil si opp (%)', verdi: Math.round(n.oppsigelsesandel * 100), mal: 10, bestatt: n.oppsigelsesandel < 0.1 },
          ];
  return { gate, malinger: m, bestatt: m.every((x) => x.bestatt) };
}
