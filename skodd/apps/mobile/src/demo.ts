/**
 * Demomodus: hele appen uten server.
 *
 * Bygges med EXPO_PUBLIC_DEMO=1. Da byttes API-klienten ut med denne, som
 * holder alt i minnet. Pris, sesong, mønster og prognose regnes fortsatt ut
 * av @skodd/core, så tallene er de samme som API-et gir. Alt nullstilles når
 * siden lastes på nytt.
 */
import {
  PAKKER, TILLEGG, VILKAR, lagTilbud, sammenlignMedIDag, parseDimensjon, normaliserRegnr,
  sesongFor, skiftvinduer, nesteVinduFor, prognose, slitasjerate, monsterTekst, finnAvvik,
  utkjopRestverdi, SKODD_GRENSE_MM,
  type HjulMaling, type Kjoretoy, type Maling, type PakkeId, type Sesong, type TilleggId,
} from '@skodd/core';
import type { Api, MontorJobb } from './api.ts';
import { ApiFeil, hentGjeldendeToken } from './klient.ts';

export const DEMOKODE = '123456';

const DAG = 86_400_000;
const iso = (d: Date): string => d.toISOString().slice(0, 10);
let teller = 0;
const nyId = (prefiks: string): string => `${prefiks}-${(teller += 1)}`;

const BILER: Record<string, Omit<Kjoretoy, 'regnr'>> = {
  AB12345: { merke: 'Volkswagen', modell: 'Golf', arsmodell: 2019, type: 'personbil', drivstoff: 'bensin', vektKg: 1350, dimensjonFor: parseDimensjon('205/55R16 91V') },
  EK54321: { merke: 'Tesla', modell: 'Model Y', arsmodell: 2023, type: 'suv', drivstoff: 'elektrisk', vektKg: 2100, dimensjonFor: parseDimensjon('255/45R19 104W') },
  EL11223: { merke: 'Volvo', modell: 'XC40 Recharge', arsmodell: 2024, type: 'suv', drivstoff: 'elektrisk', vektKg: 2150, dimensjonFor: parseDimensjon('235/50R19 103V') },
  BS99887: { merke: 'Toyota', modell: 'Yaris', arsmodell: 2017, type: 'personbil', drivstoff: 'hybrid', vektKg: 1120, dimensjonFor: parseDimensjon('185/60R15 84H') },
  CV45678: { merke: 'Porsche', modell: 'Taycan', arsmodell: 2022, type: 'ytelsesbil', drivstoff: 'elektrisk', vektKg: 2300, dimensjonFor: parseDimensjon('245/45R20 103Y') },
};
const STANDARDBIL: Omit<Kjoretoy, 'regnr'> = {
  merke: 'Skoda', modell: 'Octavia', arsmodell: 2018, type: 'personbil', drivstoff: 'bensin',
  vektKg: 1400, dimensjonFor: parseDimensjon('205/55R16 91V'),
};
const slaOpp = (regnr: string): Kjoretoy => {
  const n = normaliserRegnr(regnr);
  return { regnr: n, ...(BILER[n] ?? STANDARDBIL) };
};

interface DKunde { id: string; telefon: string; navn: string | null; epost: string | null; rolle: 'kunde' | 'montor' | 'ops' }
interface DMaling { id: string; kmStand: number; maltDato: Date; hjul: HjulMaling[] }
interface DSett {
  id: string; sesong: Sesong; status: 'pa_bil' | 'pa_lager' | 'utslitt'; viKjopte: boolean;
  brukteSesonger: number; levetidSesonger: number; lagerplass: string | null; malinger: DMaling[];
}
interface DAbo {
  id: string; kundeId: string; bil: Kjoretoy; pakke: PakkeId; tillegg: TilleggId[]; kmPerAr: number;
  manedsprisOre: number; status: string; stedstype: string; startet: Date; bindingSlutt: Date; sett: DSett[];
}
interface DJobb {
  id: string; aboId: string; vinduId: string; monterer: Sesong; status: string;
  planlagtDato: string | null; tilleggVask: boolean; henterSett: boolean; merknad: string | null; paRuten: boolean;
}

const kunder: DKunde[] = [];
const aboer: DAbo[] = [];
const jobber: DJobb[] = [];

const na = (): Date => new Date();
const hjul4 = (vf: number, hf: number, vb: number, hb: number, skjev = 0): HjulMaling[] => [
  { posisjon: 'VF', innerMm: vf - skjev, midtMm: vf + 0.2, ytterMm: vf + 0.3 },
  { posisjon: 'HF', innerMm: hf, midtMm: hf + 0.2, ytterMm: hf + 0.1 },
  { posisjon: 'VB', innerMm: vb, midtMm: vb + 0.1, ytterMm: vb + 0.1 },
  { posisjon: 'HB', innerMm: hb, midtMm: hb + 0.2, ytterMm: hb + 0.1 },
];

const vinduId = (ar: number, monterer: Sesong): string => `vindu-${ar}-${monterer}`;

function lagAbo(kunde: DKunde, regnr: string, valg: {
  tillegg?: TilleggId[]; kmPerAr?: number; stedstype?: string; startet?: Date;
  egneDekk?: 'begge_sett' | 'ett_sett' | 'ingen';
} = {}): DAbo {
  const bil = slaOpp(regnr);
  const tillegg = valg.tillegg ?? [];
  const tilbud = lagTilbud({
    dimensjon: bil.dimensjonFor, kjoretoytype: bil.type, tillegg,
    ...(valg.kmPerAr !== undefined ? { kmPerAr: valg.kmPerAr } : {}),
    flerbil: aboer.some((a) => a.kundeId === kunde.id && a.status === 'aktiv'),
  });
  const startet = valg.startet ?? na();
  const bindingSlutt = new Date(startet);
  bindingSlutt.setUTCMonth(bindingSlutt.getUTCMonth() + VILKAR.bindingManeder);
  const sesong = sesongFor(na());
  const kundenHar: Sesong[] =
    valg.egneDekk === 'ingen' ? [] : valg.egneDekk === 'ett_sett' ? [sesong] : ['sommer', 'vinter'];
  const abo: DAbo = {
    id: nyId('abo'), kundeId: kunde.id, bil, pakke: tilbud.pakke.id, tillegg,
    kmPerAr: valg.kmPerAr ?? 15_000, manedsprisOre: tilbud.manedspris, status: 'aktiv',
    stedstype: valg.stedstype ?? 'borettslag', startet, bindingSlutt,
    sett: (['sommer', 'vinter'] as const).map((s) => ({
      id: nyId('sett'), sesong: s, viKjopte: !kundenHar.includes(s),
      status: s === sesong ? 'pa_bil' as const : 'pa_lager' as const,
      brukteSesonger: 0, levetidSesonger: 4, lagerplass: s === sesong ? null : 'A-14', malinger: [],
    })),
  };
  aboer.push(abo);
  return abo;
}

/** Utgangspunktet: tre kunder i samme borettslag, og en montør med dagens rute. */
function sakorn(): void {
  const idag = na();
  const sesong = sesongFor(idag);
  const andre: Sesong = sesong === 'vinter' ? 'sommer' : 'vinter';
  const ar = idag.getUTCFullYear();

  const ida: DKunde = { id: nyId('kunde'), telefon: '+4791000001', navn: 'Ida Moen', epost: null, rolle: 'kunde' };
  const petter: DKunde = { id: nyId('kunde'), telefon: '+4791000002', navn: 'Petter Dahl', epost: null, rolle: 'kunde' };
  const sara: DKunde = { id: nyId('kunde'), telefon: '+4791000003', navn: 'Sara Nygård', epost: null, rolle: 'kunde' };
  const jonas: DKunde = { id: nyId('kunde'), telefon: '+4790000002', navn: 'Jonas Berg', epost: null, rolle: 'montor' };
  kunder.push(ida, petter, sara, jonas);

  // Ida har fått sesongens sett på for ni dager siden, og har historikk fra i fjor.
  const idaAbo = lagAbo(ida, 'AB12345', { startet: new Date(idag.getTime() - 400 * DAG) });
  const idaPa = idaAbo.sett.find((s) => s.sesong === sesong)!;
  const idaLager = idaAbo.sett.find((s) => s.sesong === andre)!;
  idaPa.brukteSesonger = 1;
  idaLager.brukteSesonger = 2;
  idaPa.malinger.push(
    { id: nyId('maling'), kmStand: 49_600, maltDato: new Date(idag.getTime() - 374 * DAG), hjul: hjul4(6.3, 6.4, 7.0, 6.9) },
    { id: nyId('maling'), kmStand: 61_400, maltDato: new Date(idag.getTime() - 9 * DAG), hjul: hjul4(5.4, 5.5, 6.3, 6.2, 0.3) },
  );
  idaLager.malinger.push(
    { id: nyId('maling'), kmStand: 55_300, maltDato: new Date(idag.getTime() - 190 * DAG), hjul: hjul4(5.0, 5.1, 5.8, 5.7) },
  );
  jobber.push({
    id: nyId('jobb'), aboId: idaAbo.id, vinduId: vinduId(ar, sesong), monterer: sesong, status: 'utfort',
    planlagtDato: iso(new Date(idag.getTime() - 9 * DAG)), tilleggVask: false, henterSett: true, merknad: null, paRuten: false,
  });

  // Petter og Sara står på montørens rute i dag. Forrige sesongs sett står fortsatt på.
  for (const [kunde, regnr] of [[petter, 'EK54321'], [sara, 'CV45678']] as const) {
    const abo = lagAbo(kunde, regnr, { startet: new Date(idag.getTime() - 200 * DAG) });
    for (const s of abo.sett) {
      s.status = s.sesong === andre ? 'pa_bil' : 'pa_lager';
      s.lagerplass = s.sesong === andre ? null : 'B-07';
    }
    jobber.push({
      id: nyId('jobb'), aboId: abo.id, vinduId: vinduId(ar, sesong), monterer: sesong, status: 'tildelt',
      planlagtDato: iso(idag), tilleggVask: regnr === 'CV45678', henterSett: true,
      merknad: regnr === 'CV45678' ? 'Plass 42. Låsebolter ligger i hanskerommet.' : null, paRuten: true,
    });
  }
}
sakorn();

function meg(): DKunde {
  const token = hentGjeldendeToken();
  const kunde = token ? kunder.find((k) => `demo:${k.telefon}` === token) : undefined;
  if (!kunde) throw new ApiFeil(401, 'Ikke innlogget');
  return kunde;
}

function mittAbo(id: string): DAbo {
  const kunde = meg();
  const abo = aboer.find((a) => a.id === id && (a.kundeId === kunde.id || kunde.rolle !== 'kunde'));
  if (!abo) throw new ApiFeil(404, 'Ukjent abonnement');
  return abo;
}

const tilMaling = (sett: DSett, m: DMaling): Maling => ({
  dekksettId: sett.id, kmStand: m.kmStand, maltDato: m.maltDato, hjul: m.hjul,
});

function prognoseFor(abo: DAbo, sett: DSett) {
  const sortert = [...sett.malinger].sort((a, b) => b.maltDato.getTime() - a.maltDato.getTime());
  const siste = sortert[0];
  if (!siste) return null;
  const forrige = sortert[1];
  return prognose({
    sisteMaling: tilMaling(sett, siste),
    sesong: sett.sesong,
    rate: forrige ? slitasjerate(tilMaling(sett, forrige), tilMaling(sett, siste)) : null,
    kmPerAr: abo.kmPerAr,
    ...(abo.bil.vektKg ? { vektKg: abo.bil.vektKg } : {}),
    na: na(),
  });
}

const telefonNorm = (t: string): string => {
  const rent = t.replace(/[\s-]/g, '');
  return rent.startsWith('+') ? rent : `+47${rent}`;
};

/** Litt ventetid, så lasting og knappetilstander oppfører seg som mot et ekte API. */
const vent = <T,>(verdi: () => T): Promise<T> =>
  new Promise((ok, feil) => setTimeout(() => { try { ok(verdi()); } catch (e) { feil(e); } }, 180));

export const demoApi: Api = {
  pakker: () => vent(() => ({
    pakker: Object.values(PAKKER), tillegg: Object.values(TILLEGG),
    vilkar: { bindingManeder: VILKAR.bindingManeder }, merkevare: { lofte: 'Alltid skodd.' },
  })),

  tilbud: (kropp) => vent(() => {
    const kjoretoy = slaOpp(kropp.regnr);
    const tilbud = lagTilbud({
      dimensjon: kjoretoy.dimensjonFor, kjoretoytype: kjoretoy.type,
      ...(kropp.kmPerAr !== undefined ? { kmPerAr: kropp.kmPerAr } : {}),
      ...(kropp.tillegg ? { tillegg: kropp.tillegg } : {}),
    });
    return { kjoretoy, tilbud, sammenligning: sammenlignMedIDag(tilbud), kampanje: null };
  }),

  reserver: () => vent(() => ({ id: nyId('res'), melding: 'Takk. Vi tar kontakt før vårsesongen.' })),

  sendKode: () => vent(() => ({ sendt: true })),

  bekreftKode: (telefon, kode) => vent(() => {
    if (kode !== DEMOKODE) throw new ApiFeil(401, 'feil_kode');
    const nummer = telefonNorm(telefon);
    let kunde = kunder.find((k) => k.telefon === nummer);
    if (!kunde) {
      kunde = { id: nyId('kunde'), telefon: nummer, navn: null, epost: null, rolle: 'kunde' };
      kunder.push(kunde);
    }
    return { token: `demo:${kunde.telefon}`, rolle: kunde.rolle, kundeId: kunde.id };
  }),

  meg: () => vent(() => {
    const kunde = meg();
    return {
      kunde: { id: kunde.id, telefon: kunde.telefon, navn: kunde.navn, epost: kunde.epost, rolle: kunde.rolle },
      abonnementer: aboer.filter((a) => a.kundeId === kunde.id).map((a) => ({
        id: a.id, status: a.status, pakke: a.pakke, manedsprisOre: a.manedsprisOre,
        regnr: a.bil.regnr, bil: `${a.bil.merke} ${a.bil.modell}`,
      })).reverse(),
    };
  }),

  oppdaterProfil: (kropp) => vent(() => {
    const kunde = meg();
    if (kropp.navn) kunde.navn = kropp.navn;
    if (kropp.epost) kunde.epost = kropp.epost;
    return { oppdatert: true };
  }),

  meldPa: (kropp) => vent(() => {
    const kunde = meg();
    // I demoen er depositumet betalt med en gang, så abonnementet er aktivt.
    const abo = lagAbo(kunde, kropp.regnr, {
      tillegg: kropp.tillegg, kmPerAr: kropp.kmPerAr, stedstype: kropp.stedstype, egneDekk: kropp.egneDekk,
    });
    return { abonnementId: abo.id, manedsprisOre: abo.manedsprisOre, depositumOre: VILKAR.depositum };
  }),

  oversikt: (id) => vent(() => {
    const abo = mittAbo(id);
    const sesong = sesongFor(na());
    const paBil = abo.sett.find((s) => s.status === 'pa_bil');
    const p = paBil ? prognoseFor(abo, paBil) : null;
    const v = nesteVinduFor(paBil?.sesong ?? sesong, na());
    return {
      abonnement: {
        id: abo.id, pakke: abo.pakke, pakkenavn: PAKKER[abo.pakke].navn, status: abo.status,
        manedsprisOre: abo.manedsprisOre, tillegg: abo.tillegg, kmPerAr: abo.kmPerAr,
        bindingSlutt: abo.bindingSlutt.toISOString(), startet: abo.startet.toISOString(), stedstype: abo.stedstype,
      },
      kjoretoy: { regnr: abo.bil.regnr, merke: abo.bil.merke, modell: abo.bil.modell, dimensjonFor: abo.bil.dimensjonFor },
      sett: abo.sett.map((s) => ({
        id: s.id, sesong: s.sesong, status: s.status, viKjopte: s.viKjopte,
        brukteSesonger: s.brukteSesonger, levetidSesonger: s.levetidSesonger, lagerplass: s.lagerplass,
      })),
      sesongNa: sesong,
      monster: p ? {
        tekst: monsterTekst(p), naMm: p.naMm, sesongerIgjen: p.sesongerIgjen, brukt: p.brukt,
        byttesAnslag: iso(p.byttesAnslag),
      } : null,
      nesteVindu: { monterer: v.monterer, start: iso(v.start), slutt: iso(v.slutt) },
    };
  }),

  malinger: (id) => vent(() => {
    const abo = mittAbo(id);
    const paBil = abo.sett.find((s) => s.status === 'pa_bil');
    const alle = abo.sett.flatMap((s) => s.malinger.map((m) => ({
      id: m.id, dekksettId: s.id, kmStand: m.kmStand, maltDato: m.maltDato.toISOString(), hjul: m.hjul,
      minMm: Math.min(...m.hjul.map((h) => Math.min(h.innerMm, h.midtMm, h.ytterMm))),
      sesong: s.sesong, settStatus: s.status,
    })));
    // Settet på bilen først, så nyeste måling først.
    alle.sort((a, b) =>
      Number(b.dekksettId === paBil?.id) - Number(a.dekksettId === paBil?.id)
      || b.maltDato.localeCompare(a.maltDato));
    return { malinger: alle };
  }),

  endreTillegg: (id, tillegg) => vent(() => {
    const abo = mittAbo(id);
    abo.tillegg = tillegg;
    abo.manedsprisOre = PAKKER[abo.pakke].pris
      + tillegg.filter((t) => TILLEGG[t].type === 'mnd').reduce((s, t) => s + TILLEGG[t].pris, 0);
    return { manedsprisOre: abo.manedsprisOre };
  }),

  oppsigelse: (id) => vent(() => {
    const abo = mittAbo(id);
    const iBinding = abo.bindingSlutt > na();
    const sisteDag = na();
    sisteDag.setUTCMonth(sisteDag.getUTCMonth() + 1);
    return {
      bindingSlutt: abo.bindingSlutt.toISOString(), iBinding, sisteDag: sisteDag.toISOString(),
      utkjopOre: iBinding ? utkjopRestverdi(abo.sett.map((s) => ({
        viKjopte: s.viKjopte, innkjopsprisEksMva: 350_000, brukteSesonger: s.brukteSesonger, levetidSesonger: s.levetidSesonger,
      }))) : 0,
    };
  }),

  sigOpp: (id) => vent(() => {
    const abo = mittAbo(id);
    abo.status = 'oppsagt';
    const sisteDag = na();
    sisteDag.setUTCMonth(sisteDag.getUTCMonth() + 1);
    return { utkjopOre: 0, sisteDag: sisteDag.toISOString() };
  }),

  vinduer: () => vent(() => {
    const ar = na().getUTCFullYear();
    const liste = [...skiftvinduer(ar), ...skiftvinduer(ar + 1)].map((v) => ({
      id: vinduId(v.start.getUTCFullYear(), v.monterer), ar: v.start.getUTCFullYear(), monterer: v.monterer,
      start: iso(v.start), slutt: iso(v.slutt), lovpalagtFrist: v.lovpalagtFrist ? iso(v.lovpalagtFrist) : null,
    }));
    const neste = liste.find((v) => new Date(v.slutt) >= na()) ?? liste[0]!;
    return { vinduer: liste, anbefalt: { monterer: neste.monterer, start: neste.start } };
  }),

  bookSkift: (kropp) => vent(() => {
    const abo = mittAbo(kropp.abonnementId);
    const fra_for = jobber.find((j) => j.aboId === abo.id && j.vinduId === kropp.vinduId && j.status !== 'utfort');
    if (fra_for) {
      fra_for.tilleggVask = kropp.tilleggVask ?? false;
      return { id: fra_for.id, status: fra_for.status, flyttet: true };
    }
    const monterer: Sesong = kropp.vinduId.endsWith('vinter') ? 'vinter' : 'sommer';
    const jobb: DJobb = {
      id: nyId('jobb'), aboId: abo.id, vinduId: kropp.vinduId, monterer, status: 'planlagt',
      planlagtDato: null, tilleggVask: kropp.tilleggVask ?? false, henterSett: true,
      merknad: kropp.merknad ?? null, paRuten: false,
    };
    jobber.push(jobb);
    return { id: jobb.id, status: jobb.status, flyttet: false };
  }),

  mineJobber: () => vent(() => {
    const kunde = meg();
    const mine = new Set(aboer.filter((a) => a.kundeId === kunde.id).map((a) => a.id));
    return {
      jobber: jobber.filter((j) => mine.has(j.aboId)).reverse()
        .map((j) => ({ id: j.id, monterer: j.monterer, status: j.status, planlagtDato: j.planlagtDato })),
    };
  }),

  meldSkade: (kropp) => vent(() => {
    const abo = mittAbo(kropp.abonnementId);
    const harFelg = abo.tillegg.includes('felg_pluss');
    const dekkesAv = kropp.type === 'felg' ? (harFelg ? 'felg_pluss' : 'kunde')
      : kropp.type === 'kollisjon' ? 'bilforsikring' : 'skodd';
    return {
      id: nyId('skade'), egenandelOre: 0, dekkesAv,
      frist: kropp.type === 'punktering' ? new Date(na().getTime() + 2 * DAG).toISOString() : null,
    };
  }),

  sendNps: () => vent(() => ({ id: nyId('nps') })),

  montorJobber: (dato) => vent(() => {
    const kunde = meg();
    if (kunde.rolle === 'kunde') throw new ApiFeil(403, 'Mangler tilgang');
    const liste: MontorJobb[] = jobber
      .filter((j) => j.paRuten && j.planlagtDato === dato)
      .map((j) => {
        const abo = aboer.find((a) => a.id === j.aboId)!;
        const eier = kunder.find((k) => k.id === abo.kundeId)!;
        return {
          id: j.id, regnr: abo.bil.regnr, monterer: j.monterer, status: j.status,
          sted: { navn: 'Solbakken borettslag', adresse: 'Solbakkveien 12, 0588 Oslo', type: 'borettslag' },
          adresse: null, tilleggVask: j.tilleggVask, henterSett: j.henterSett,
          kunde: { navn: eier.navn, telefon: eier.telefon }, merknad: j.merknad,
        };
      });
    return { dato, jobber: liste };
  }),

  fullforJobb: (id, kropp) => vent(() => {
    const jobb = jobber.find((j) => j.id === id);
    if (!jobb) throw new ApiFeil(404, 'Ukjent jobb');
    if (jobb.status === 'utfort') throw new ApiFeil(409, 'Jobben er alt fullført');
    const abo = aboer.find((a) => a.id === jobb.aboId)!;
    const patt = abo.sett.find((s) => s.sesong === kropp.monterteSesong)!;
    const av = abo.sett.find((s) => s.sesong !== kropp.monterteSesong)!;

    patt.malinger.push({ id: nyId('maling'), kmStand: kropp.kmStand, maltDato: na(), hjul: kropp.hjul });
    patt.status = 'pa_bil';
    patt.lagerplass = null;
    av.status = 'pa_lager';
    av.lagerplass = 'B-07';
    av.brukteSesonger += 1;
    jobb.status = 'utfort';

    const p = prognoseFor(abo, patt)!;
    const minMm = Math.min(...kropp.hjul.map((h) => Math.min(h.innerMm, h.midtMm, h.ytterMm)));
    const maBytteSett = p.maBytteNa || minMm <= SKODD_GRENSE_MM[patt.sesong];
    if (maBytteSett) patt.status = 'utslitt';
    const v = nesteVinduFor(patt.sesong, na());
    return {
      jobbId: jobb.id, monsterTekst: monsterTekst(p), maBytteSett,
      avvik: finnAvvik(tilMaling(patt, patt.malinger[patt.malinger.length - 1]!), patt.sesong),
      nesteVindu: { monterer: v.monterer, start: iso(v.start) },
    };
  }),
};
