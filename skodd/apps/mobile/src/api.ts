/** Typet klient mot Skodd-API-et. Ett sted for alle kall. */
import Constants from 'expo-constants';
import type {
  Dekkdimensjon, HjulMaling, PakkeId, Pakke, Tillegg, TilleggId, Tilbud, Sammenligning,
  Kjoretoy, Sesong, Stedstype, Adresse,
} from '@skodd/core';

const base: string = (
  process.env.EXPO_PUBLIC_API_BASE
  ?? (Constants.expoConfig?.extra?.['apiBase'] as string | undefined)
  ?? 'http://localhost:8080'
).replace(/\/$/, '');

export class ApiFeil extends Error {
  constructor(
    public readonly status: number,
    melding: string,
    public readonly detaljer?: { felt: string; melding: string }[],
  ) {
    super(melding);
    this.name = 'ApiFeil';
  }
}

let token: string | null = null;
export const settToken = (nytt: string | null): void => { token = nytt; };

async function kall<T>(sti: string, valg: { metode?: string; kropp?: unknown } = {}): Promise<T> {
  const svar = await fetch(`${base}/v1${sti}`, {
    method: valg.metode ?? 'GET',
    headers: {
      ...(valg.kropp ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(valg.kropp ? { body: JSON.stringify(valg.kropp) } : {}),
  });

  const tekst = await svar.text();
  const data = tekst ? JSON.parse(tekst) : {};
  if (!svar.ok) {
    throw new ApiFeil(svar.status, data.feil ?? 'Noe gikk galt', data.detaljer);
  }
  return data as T;
}

export interface TilbudSvar {
  kjoretoy: Kjoretoy;
  tilbud: Tilbud;
  sammenligning: Sammenligning;
  kampanje: { kode: string; gratisManeder: number } | null;
}

export interface Oversikt {
  abonnement: {
    id: string; pakke: PakkeId; pakkenavn: string; status: string;
    manedsprisOre: number; tillegg: TilleggId[]; kmPerAr: number;
    bindingSlutt: string | null; startet: string | null; stedstype: string;
  };
  kjoretoy: { regnr: string; merke: string; modell: string; dimensjonFor: Dekkdimensjon } | null;
  sett: {
    id: string; sesong: Sesong; status: string; viKjopte: boolean;
    brukteSesonger: number; levetidSesonger: number; lagerplass: string | null;
  }[];
  sesongNa: Sesong;
  monster: { tekst: string; naMm: number; sesongerIgjen: number; brukt: number; byttesAnslag: string } | null;
  nesteVindu: { monterer: Sesong; start: string; slutt: string };
}

export interface MontorJobb {
  id: string;
  regnr: string;
  monterer: Sesong;
  status: string;
  sted: { navn: string; adresse: string; type: Stedstype } | null;
  adresse: Record<string, string> | null;
  tilleggVask: boolean;
  henterSett: boolean;
  kunde: { navn: string | null; telefon: string };
  merknad: string | null;
}

export const api = {
  pakker: () => kall<{ pakker: Pakke[]; tillegg: Tillegg[]; vilkar: Record<string, number>; merkevare: { lofte: string } }>('/pakker'),

  tilbud: (kropp: { regnr: string; kmPerAr?: number; tillegg?: TilleggId[]; kampanjekode?: string }) =>
    kall<TilbudSvar>('/tilbud', { metode: 'POST', kropp }),

  reserver: (kropp: { telefon: string; regnr?: string; postnummer?: string; kilde?: string }) =>
    kall<{ id: string; melding: string }>('/reservasjoner', { metode: 'POST', kropp }),

  sendKode: (telefon: string) => kall<{ sendt: boolean }>('/auth/kode', { metode: 'POST', kropp: { telefon } }),

  bekreftKode: (telefon: string, kode: string) =>
    kall<{ token: string; rolle: 'kunde' | 'montor' | 'ops'; kundeId: string }>(
      '/auth/bekreft', { metode: 'POST', kropp: { telefon, kode } },
    ),

  meg: () => kall<{
    kunde: { id: string; telefon: string; navn: string | null; epost: string | null; rolle: 'kunde' | 'montor' | 'ops' } | null;
    abonnementer: { id: string; status: string; pakke: PakkeId; manedsprisOre: number; regnr: string; bil: string }[];
  }>('/meg'),

  oppdaterProfil: (kropp: { navn?: string; epost?: string }) =>
    kall<{ oppdatert: boolean }>('/meg', { metode: 'PATCH', kropp }),

  meldPa: (kropp: {
    regnr: string; pakke: PakkeId; tillegg: TilleggId[]; kmPerAr: number;
    stedstype: Stedstype; stedId?: string; adresse?: Adresse; kampanjekode?: string;
    godtarVilkar: true; egneDekk: 'begge_sett' | 'ett_sett' | 'ingen';
  }) => kall<{ abonnementId: string; manedsprisOre: number; depositumOre: number; betalingsUrl?: string }>(
    '/abonnementer', { metode: 'POST', kropp },
  ),

  oversikt: (id: string) => kall<Oversikt>(`/abonnementer/${id}`),

  endreTillegg: (id: string, tillegg: TilleggId[]) =>
    kall<{ manedsprisOre: number }>(`/abonnementer/${id}/tillegg`, { metode: 'PUT', kropp: { tillegg } }),

  oppsigelse: (id: string) =>
    kall<{ bindingSlutt: string | null; iBinding: boolean; utkjopOre: number; sisteDag: string }>(
      `/abonnementer/${id}/oppsigelse`,
    ),

  sigOpp: (id: string) =>
    kall<{ utkjopOre: number; sisteDag: string }>(`/abonnementer/${id}/oppsigelse`, {
      metode: 'POST', kropp: { bekreftet: true },
    }),

  malinger: (id: string) => kall<{
    malinger: {
      id: string; dekksettId: string; kmStand: number; maltDato: string;
      hjul: HjulMaling[]; minMm: number; sesong: Sesong; settStatus: string;
    }[];
  }>(`/abonnementer/${id}/malinger`),

  vinduer: () => kall<{
    vinduer: { id: string; ar: number; monterer: Sesong; start: string; slutt: string; lovpalagtFrist: string | null }[];
    anbefalt: { monterer: Sesong; start: string };
  }>('/vinduer'),

  bookSkift: (kropp: {
    abonnementId: string; vinduId: string; stedId?: string; adresse?: Adresse;
    tilleggVask?: boolean; merknad?: string;
  }) => kall<{ id: string; status: string; flyttet: boolean }>('/jobber', { metode: 'POST', kropp }),

  mineJobber: () => kall<{ jobber: { id: string; monterer: Sesong; status: string; planlagtDato: string | null }[] }>('/jobber'),

  meldSkade: (kropp: {
    abonnementId: string; type: 'punktering' | 'odelagt_dekk' | 'felg' | 'kollisjon' | 'annet';
    posisjon?: string; beskrivelse: string; bildeUrler?: string[];
  }) => kall<{ id: string; egenandelOre: number; dekkesAv: string; frist: string | null }>(
    '/skade', { metode: 'POST', kropp },
  ),

  sendNps: (kropp: { abonnementId: string; jobbId?: string; score: number; kommentar?: string }) =>
    kall<{ id: string }>('/nps', { metode: 'POST', kropp }),

  montorJobber: (dato: string) => kall<{ dato: string; jobber: MontorJobb[] }>(`/montor/jobber?dato=${dato}`),

  fullforJobb: (id: string, kropp: {
    kmStand: number; monterteSesong: Sesong; hjul: HjulMaling[]; hjulAvmontert?: HjulMaling[];
    momentNm?: number; merknad?: string; bildeUrler?: string[]; henterSett?: boolean;
  }) => kall<{
    jobbId: string; monsterTekst: string; maBytteSett: boolean;
    avvik: { posisjon: string; type: string; detalj: string }[];
    nesteVindu: { monterer: string; start: string };
  }>(`/montor/jobber/${id}/fullfor`, { metode: 'POST', kropp }),
};
