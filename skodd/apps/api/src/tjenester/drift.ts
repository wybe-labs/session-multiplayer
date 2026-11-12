/**
 * Drift: sesongvinduer, jobber, ruter og nøkkeltall.
 *
 * Dette er driftssystemet konseptet beskriver som «Airtable» i piloten,
 * bare med regnestykkene innebygd, slik at kostnad per skift og gatene
 * måles på ekte data fra første dag.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  skiftvinduer, nesteVindu, planleggRute, bestarGate3, vurderGate, settMinMm,
  slitasjerate, prognose, monsterTekst, finnAvvik, SKODD_GRENSE_MM, VILKAR,
  type Jobb as RuteJobb, type Sted as RuteSted, type Maling, type FullforJobb,
  type Noktall, type GateId, type Rute,
} from '@skodd/core';
import type { Db } from '../db/client.ts';
import {
  abonnementer, dekksett, hendelser, jobber, kjoretoy, kunder, lagre, malinger,
  npsSvar, reservasjoner, skademeldinger, steder, vinduer,
} from '../db/schema.ts';
import { nyId } from '../ids.ts';
import type { Sms } from '../adapters/index.ts';
import { MELDINGER } from '../adapters/sms.ts';
import { logg } from './hendelse.ts';
import { norskDato } from './abonnement.ts';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Lager de to vinduene for et år hvis de ikke finnes. Idempotent. */
export async function sikreVinduer(db: Db, ar: number, region: 'sor' | 'nord' = 'sor'): Promise<void> {
  for (const v of skiftvinduer(ar, region)) {
    await db.insert(vinduer).values({
      id: nyId(),
      ar,
      monterer: v.monterer,
      region,
      start: iso(v.start),
      slutt: iso(v.slutt),
      lovpalagtFrist: v.lovpalagtFrist ? iso(v.lovpalagtFrist) : null,
    }).onConflictDoNothing();
  }
}

/**
 * Oppretter en jobb per aktivt abonnement i vinduet. Kjøres når vinduet
 * åpner, og kan kjøres på nytt uten å lage doble jobber.
 */
export async function planleggSesong(db: Db, vinduId: string): Promise<{ opprettet: number }> {
  const [vindu] = await db.select().from(vinduer).where(eq(vinduer.id, vinduId));
  if (!vindu) throw Object.assign(new Error('Ukjent vindu'), { statusCode: 404 });

  const aktive = await db.select().from(abonnementer)
    .where(inArray(abonnementer.status, ['aktiv', 'pause']));
  const finnes = await db.select({ abonnementId: jobber.abonnementId }).from(jobber)
    .where(eq(jobber.vinduId, vinduId));
  const harJobb = new Set(finnes.map((f) => f.abonnementId));

  let opprettet = 0;
  for (const abo of aktive) {
    if (harJobb.has(abo.id) || abo.status !== 'aktiv') continue;
    await db.insert(jobber).values({
      id: nyId(),
      abonnementId: abo.id,
      vinduId,
      stedId: abo.stedId ?? null,
      adresse: abo.adresse ?? null,
      monterer: vindu.monterer,
      status: 'planlagt',
      tilleggVask: (abo.tillegg ?? []).includes('vask_ved_skift'),
    });
    opprettet += 1;
  }
  await logg(db, 'sesong.planlagt', { data: { vinduId, opprettet } });
  return { opprettet };
}

export interface JobbMedSted {
  jobb: typeof jobber.$inferSelect;
  regnr: string;
  sted: typeof steder.$inferSelect | null;
  kundeTelefon: string;
  kundeNavn: string | null;
}

export async function hentJobber(
  db: Db, filter: { dato?: string; montorId?: string; vinduId?: string; status?: ('planlagt' | 'tildelt' | 'utfort' | 'avlyst')[] },
): Promise<JobbMedSted[]> {
  const betingelser = [
    filter.dato ? eq(jobber.planlagtDato, filter.dato) : undefined,
    filter.montorId ? eq(jobber.montorId, filter.montorId) : undefined,
    filter.vinduId ? eq(jobber.vinduId, filter.vinduId) : undefined,
    filter.status ? inArray(jobber.status, filter.status) : undefined,
  ].filter((b) => b !== undefined);

  const rader = await db
    .select({ jobb: jobber, regnr: kjoretoy.regnr, sted: steder, telefon: kunder.telefon, navn: kunder.navn })
    .from(jobber)
    .innerJoin(abonnementer, eq(jobber.abonnementId, abonnementer.id))
    .innerJoin(kjoretoy, eq(abonnementer.kjoretoyId, kjoretoy.id))
    .innerJoin(kunder, eq(abonnementer.kundeId, kunder.id))
    .leftJoin(steder, eq(jobber.stedId, steder.id))
    .where(betingelser.length ? and(...betingelser) : undefined)
    .orderBy(asc(jobber.planlagtDato));

  return rader.map((r) => ({
    jobb: r.jobb, regnr: r.regnr, sted: r.sted, kundeTelefon: r.telefon, kundeNavn: r.navn,
  }));
}

/**
 * Tildeler en dag til en montør: jobber med samme sted først, så ruten
 * planlegges og kostnaden per skift regnes ut mot Gate 3.
 */
export async function tildelDag(
  db: Db, vinduId: string, dato: string, montorId: string, maksJobber = 20,
): Promise<{ rute: Rute; bestarGate3: boolean }> {
  const kandidater = await hentJobber(db, { vinduId, status: ['planlagt'] });
  // Tettest sted først. Det er tetthet som gjør et skift billig.
  const perSted = new Map<string, JobbMedSted[]>();
  for (const k of kandidater) {
    const nokkel = k.jobb.stedId ?? `adresse:${k.jobb.id}`;
    perSted.set(nokkel, [...(perSted.get(nokkel) ?? []), k]);
  }
  const sortert = [...perSted.values()].sort((a, b) => b.length - a.length).flat().slice(0, maksJobber);

  for (const k of sortert) {
    await db.update(jobber).set({ montorId, planlagtDato: dato, status: 'tildelt' })
      .where(eq(jobber.id, k.jobb.id));
  }

  const alleSteder = await db.select().from(steder);
  const ruteSteder: RuteSted[] = alleSteder.map((s) => ({
    id: s.id, navn: s.navn, type: s.type, adresse: s.adresse,
    ...(s.lat !== null ? { lat: s.lat } : {}), ...(s.lon !== null ? { lon: s.lon } : {}),
  }));
  // Jobber uten sted er hjemmebesøk: ett «sted» hver, slik kostnaden faktisk blir.
  const hjemme: RuteSted[] = sortert.filter((k) => !k.jobb.stedId).map((k) => ({
    id: `adresse:${k.jobb.id}`,
    navn: (k.jobb.adresse?.gate as string) ?? 'Hjemme',
    type: 'hjemme' as const,
    adresse: `${k.jobb.adresse?.gate ?? ''} ${k.jobb.adresse?.poststed ?? ''}`.trim(),
  }));

  const ruteJobber: RuteJobb[] = sortert.map((k) => ({
    id: k.jobb.id,
    stedId: k.jobb.stedId ?? `adresse:${k.jobb.id}`,
    abonnementId: k.jobb.abonnementId,
    regnr: k.regnr,
    monterer: k.jobb.monterer,
    henterSett: k.jobb.henterSett,
    tilleggVask: k.jobb.tilleggVask,
  }));

  const rute = planleggRute(ruteJobber, [...ruteSteder, ...hjemme], new Date(dato), montorId);
  await logg(db, 'dag.tildelt', {
    data: { dato, montorId, antall: rute.antallJobber, kostnadPerSkiftOre: rute.kostnadPerSkiftOre },
  });
  return { rute, bestarGate3: bestarGate3(rute) };
}

/** Sender påminnelse til kundene som får besøk i morgen. */
export async function sendPaminnelser(db: Db, sms: Sms, dato: string): Promise<number> {
  const liste = await hentJobber(db, { dato, status: ['tildelt'] });
  for (const j of liste) {
    const sted = j.sted?.navn ?? (j.jobb.adresse?.gate as string) ?? 'adressen din';
    await sms.send({
      til: j.kundeTelefon,
      type: 'paminnelse',
      tekst: MELDINGER.pamminnelse(norskDato(new Date(dato)), sted),
    });
  }
  return liste.length;
}

export interface FullforResultat {
  jobbId: string;
  monsterTekst: string;
  avvik: { posisjon: string; type: string; detalj: string }[];
  maBytteSett: boolean;
  nesteVindu: { monterer: string; start: string };
}

/**
 * Montøren fullfører jobben. Her fanges all data: mønster på fire hjul,
 * kilometerstand, bilder og tiltrekkingsmoment. Dette er råstoffet
 * konseptet kaller datavirksomheten.
 */
export async function fullforJobb(
  db: Db, sms: Sms, jobbId: string, input: FullforJobb, maltAv?: string, na = new Date(),
): Promise<FullforResultat> {
  const [jobb] = await db.select().from(jobber).where(eq(jobber.id, jobbId));
  if (!jobb) throw Object.assign(new Error('Ukjent jobb'), { statusCode: 404 });
  if (jobb.status === 'utfort') throw Object.assign(new Error('Jobben er alt fullført'), { statusCode: 409 });

  const [abo] = await db.select().from(abonnementer).where(eq(abonnementer.id, jobb.abonnementId));
  if (!abo) throw Object.assign(new Error('Ukjent abonnement'), { statusCode: 404 });
  const [bil] = await db.select().from(kjoretoy).where(eq(kjoretoy.id, abo.kjoretoyId));

  const sett = await db.select().from(dekksett).where(eq(dekksett.abonnementId, abo.id));
  const pattSett = sett.find((s) => s.sesong === input.monterteSesong);
  const avSett = sett.find((s) => s.sesong !== input.monterteSesong);
  if (!pattSett) throw Object.assign(new Error('Fant ikke settet som ble montert'), { statusCode: 409 });

  const minMm = Math.min(...input.hjul.map((h) => Math.min(h.innerMm, h.midtMm, h.ytterMm)));
  const malingId = nyId();
  await db.insert(malinger).values({
    id: malingId,
    dekksettId: pattSett.id,
    jobbId,
    kmStand: input.kmStand,
    maltDato: na,
    hjul: input.hjul,
    minMm: minMm.toFixed(1),
    maltAv: maltAv ?? null,
    bildeUrler: input.bildeUrler,
  });

  if (input.hjulAvmontert && avSett) {
    const minAv = Math.min(...input.hjulAvmontert.map((h) => Math.min(h.innerMm, h.midtMm, h.ytterMm)));
    await db.insert(malinger).values({
      id: nyId(),
      dekksettId: avSett.id,
      jobbId,
      kmStand: input.kmStand,
      maltDato: na,
      hjul: input.hjulAvmontert,
      minMm: minAv.toFixed(1),
      maltAv: maltAv ?? null,
      bildeUrler: [],
    });
  }

  // Settet som gikk på bilen står nå på bilen. Det andre går på lager og
  // har brukt opp én sesong.
  await db.update(dekksett).set({ status: 'pa_bil' }).where(eq(dekksett.id, pattSett.id));
  if (avSett) {
    await db.update(dekksett).set({
      status: input.henterSett ? 'pa_lager' : avSett.status,
      brukteSesonger: avSett.brukteSesonger + 1,
    }).where(eq(dekksett.id, avSett.id));
  }

  await db.update(jobber).set({
    status: 'utfort',
    fullfort: na,
    kmStand: input.kmStand,
    momentNm: input.momentNm ?? null,
    merknad: input.merknad ?? null,
  }).where(eq(jobber.id, jobbId));

  // Prognose på det settet kunden nå kjører på.
  const tidligere = await db.select().from(malinger)
    .where(eq(malinger.dekksettId, pattSett.id))
    .orderBy(desc(malinger.maltDato)).limit(2);
  const tilMaling = (r: typeof tidligere[number]): Maling => ({
    dekksettId: r.dekksettId, kmStand: r.kmStand, maltDato: r.maltDato, hjul: r.hjul,
  });
  const rate = tidligere.length === 2 ? slitasjerate(tilMaling(tidligere[1]!), tilMaling(tidligere[0]!)) : null;
  const p = prognose({
    sisteMaling: { dekksettId: pattSett.id, kmStand: input.kmStand, maltDato: na, hjul: input.hjul },
    sesong: pattSett.sesong,
    rate,
    kmPerAr: abo.kmPerAr,
    ...(bil?.vektKg ? { vektKg: bil.vektKg } : {}),
    na,
  });

  const avvik = finnAvvik(
    { dekksettId: pattSett.id, kmStand: input.kmStand, maltDato: na, hjul: input.hjul },
    pattSett.sesong,
  );

  const maBytte = p.maBytteNa || minMm <= SKODD_GRENSE_MM[pattSett.sesong];
  if (maBytte) {
    await db.update(dekksett).set({ status: 'utslitt' }).where(eq(dekksett.id, pattSett.id));
    await logg(db, 'dekk.ma_byttes', {
      abonnementId: abo.id, jobbId,
      data: { dekksettId: pattSett.id, minMm, sesong: pattSett.sesong, dimensjon: pattSett.dimensjon },
    });
  }

  const vindu = nesteVindu(new Date(na.getTime() + 86_400_000 * 30));
  const [kunde] = await db.select().from(kunder).where(eq(kunder.id, abo.kundeId));
  const tekst = monsterTekst(p);
  if (kunde) {
    await sms.send({
      til: kunde.telefon,
      type: 'skift.utfort',
      tekst: maBytte
        ? MELDINGER.nyttSettKommer(tekst)
        : MELDINGER.skiftUtfort(tekst, norskDato(vindu.start)),
    });
  }

  await logg(db, 'skift.utfort', {
    abonnementId: abo.id, jobbId,
    data: {
      kmStand: input.kmStand, minMm, mmPer1000Km: p.mmPer1000Km, sesong: pattSett.sesong,
      sesongerIgjen: p.sesongerIgjen, avvik: avvik.length, momentNm: input.momentNm ?? null,
    },
  });

  return {
    jobbId,
    monsterTekst: tekst,
    avvik,
    maBytteSett: maBytte,
    nesteVindu: { monterer: vindu.monterer, start: iso(vindu.start) },
  };
}

/** Skademelding fra appen. Punktering er inkludert, resten følger tabellen i vilkårene. */
export async function meldSkade(
  db: Db, sms: Sms, input: { abonnementId: string; type: string; posisjon?: string; beskrivelse: string; bildeUrler: string[] },
  na = new Date(),
): Promise<{ id: string; egenandelOre: number; dekkesAv: string; frist: Date | null }> {
  const [abo] = await db.select().from(abonnementer).where(eq(abonnementer.id, input.abonnementId));
  if (!abo) throw Object.assign(new Error('Ukjent abonnement'), { statusCode: 404 });

  const brukteSkadedekk = await db
    .select({ antall: sql<number>`count(*)::int` })
    .from(skademeldinger)
    .where(and(
      eq(skademeldinger.abonnementId, input.abonnementId),
      eq(skademeldinger.type, 'odelagt_dekk'),
      eq(skademeldinger.status, 'utfort'),
    ));
  const brukt = brukteSkadedekk[0]?.antall ?? 0;
  const harFelgPluss = (abo.tillegg ?? []).includes('felg_pluss');

  let egenandelOre = 0;
  let dekkesAv: 'skodd' | 'felg_pluss' | 'kunde' | 'bilforsikring' = 'skodd';
  let frist: Date | null = null;

  switch (input.type) {
    case 'punktering':
      frist = new Date(na.getTime() + 48 * 3_600_000);
      break;
    case 'odelagt_dekk':
      if (brukt >= VILKAR.inkluderteSkadedekkPerBinding) egenandelOre = VILKAR.skadeEgenandel;
      break;
    case 'felg':
      dekkesAv = harFelgPluss ? 'felg_pluss' : 'kunde';
      break;
    case 'kollisjon':
      dekkesAv = 'bilforsikring';
      break;
    default:
      dekkesAv = 'skodd';
  }

  const id = nyId();
  await db.insert(skademeldinger).values({
    id,
    abonnementId: input.abonnementId,
    type: input.type as 'punktering',
    posisjon: (input.posisjon ?? null) as null,
    beskrivelse: input.beskrivelse,
    bildeUrler: input.bildeUrler,
    egenandelOre,
    dekkesAv,
    frist,
  });

  if (input.type === 'punktering') {
    const [kunde] = await db.select().from(kunder).where(eq(kunder.id, abo.kundeId));
    if (kunde) await sms.send({ til: kunde.telefon, type: 'skade.mottatt', tekst: MELDINGER.punkteringMottatt() });
  }

  await logg(db, 'skade.meldt', { abonnementId: input.abonnementId, data: { type: input.type, egenandelOre, dekkesAv } });
  return { id, egenandelOre, dekkesAv, frist };
}

/** Nøkkeltallene gatene måles på. Ett kall, hele styringsbildet. */
export async function noktall(db: Db): Promise<Noktall & { aktiveAbonnementer: number; utforteSkift: number }> {
  const antall = sql<number>`count(*)::int`;

  const [res] = await db.select({ n: antall }).from(reservasjoner);
  const [brl] = await db.select({ n: antall }).from(steder)
    .where(and(eq(steder.type, 'borettslag'), eq(steder.avtalestatus, 'ja')));
  const [dep] = await db.select({ n: antall }).from(abonnementer)
    .where(sql`${abonnementer.depositumBetalt} is not null`);
  const [akt] = await db.select({ n: antall }).from(abonnementer)
    .where(eq(abonnementer.status, 'aktiv'));
  const [opp] = await db.select({ n: antall }).from(abonnementer)
    .where(eq(abonnementer.status, 'oppsagt'));
  const [utf] = await db.select({ n: antall }).from(jobber)
    .where(eq(jobber.status, 'utfort'));
  const [lag] = await db.select({ n: antall }).from(lagre).where(eq(lagre.aktiv, true));

  const npsRader = await db.select({ score: npsSvar.score }).from(npsSvar);
  const nps = npsRader.length
    ? Math.round(
        ((npsRader.filter((r) => r.score >= 9).length - npsRader.filter((r) => r.score <= 6).length) /
          npsRader.length) * 100,
      )
    : 0;

  // Kostnad per skift hentes fra hendelsesloggen: snitt over tildelte dager.
  const dager = await db.select({ data: hendelser.data }).from(hendelser)
    .where(eq(hendelser.type, 'dag.tildelt'));
  const tall = dager
    .map((d) => Number(d.data?.['kostnadPerSkiftOre'] ?? 0))
    .filter((n) => n > 0);
  const kostnadPerSkiftOre = tall.length
    ? Math.round(tall.reduce((a, b) => a + b, 0) / tall.length)
    : 0;

  const aktive = akt?.n ?? 0;
  const oppsagte = opp?.n ?? 0;

  return {
    reservasjoner: res?.n ?? 0,
    borettslagJa: brl?.n ?? 0,
    betalteDepositum: dep?.n ?? 0,
    harLagerpartner: (lag?.n ?? 0) > 0,
    kostnadPerSkiftOre,
    nps,
    oppsigelsesandel: aktive + oppsagte === 0 ? 0 : oppsagte / (aktive + oppsagte),
    aktiveAbonnementer: aktive,
    utforteSkift: utf?.n ?? 0,
  };
}

export const gateStatus = (n: Noktall) =>
  (['gate1', 'gate2', 'gate3'] as GateId[]).map((id) => vurderGate(id, n));

export { settMinMm };
