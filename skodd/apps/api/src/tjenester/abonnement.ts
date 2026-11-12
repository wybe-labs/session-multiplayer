/** Påmelding, tillegg og oppsigelse. */
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  PAKKER, TILLEGG, VILKAR, lagTilbud, utkjopRestverdi, nesteVindu, sesongFor,
  prognose, slitasjerate, settMinMm, monsterTekst, type Maling, type OpprettAbonnement,
  type TilleggId, type Ore,
} from '@skodd/core';
import type { Db } from '../db/client.ts';
import { abonnementer, dekksett, kjoretoy, kunder, kampanjekoder, malinger, reservasjoner } from '../db/schema.ts';
import { nyId, nyKampanjekode } from '../ids.ts';
import type { Betaling, Kjoretoyregister, Sms } from '../adapters/index.ts';
import { MELDINGER } from '../adapters/sms.ts';
import { logg } from './hendelse.ts';
import { hentKampanje } from './tilbud.ts';

export interface Avhengigheter {
  db: Db;
  register: Kjoretoyregister;
  betaling: Betaling;
  sms: Sms;
}

export interface PameldingResultat {
  abonnementId: string;
  manedsprisOre: Ore;
  depositumOre: Ore;
  betalingsUrl?: string;
  betalingRef: string;
}

/** Oppretter eller oppdaterer kjøretøyet, abonnementet og de to dekksettene. */
export async function meldPa(
  d: Avhengigheter,
  kundeId: string,
  input: OpprettAbonnement,
  na = new Date(),
): Promise<PameldingResultat> {
  const bil = await d.register.slaOpp(input.regnr);
  if (!bil) throw Object.assign(new Error('Fant ikke bilen'), { statusCode: 404 });

  const [eksisterende] = await d.db.select().from(kjoretoy).where(eq(kjoretoy.regnr, bil.regnr));
  let kjoretoyId = eksisterende?.id;
  if (!kjoretoyId) {
    kjoretoyId = nyId();
    await d.db.insert(kjoretoy).values({
      id: kjoretoyId,
      regnr: bil.regnr,
      merke: bil.merke,
      modell: bil.modell,
      arsmodell: bil.arsmodell,
      type: bil.type,
      drivstoff: bil.drivstoff,
      vektKg: bil.vektKg ?? null,
      dimensjonFor: bil.dimensjonFor,
      dimensjonBak: bil.dimensjonBak ?? null,
    });
  }

  const aktiveFraFor = await d.db
    .select({ id: abonnementer.id })
    .from(abonnementer)
    .where(and(eq(abonnementer.kundeId, kundeId), eq(abonnementer.status, 'aktiv')));

  const kampanje = await hentKampanje(d.db, input.kampanjekode);
  const tilbud = lagTilbud({
    dimensjon: bil.dimensjonFor,
    kjoretoytype: bil.type,
    kmPerAr: input.kmPerAr,
    tillegg: input.tillegg as TilleggId[],
    flerbil: aktiveFraFor.length > 0,
    kampanje,
  });
  if (tilbud.pakke.id !== input.pakke) {
    throw Object.assign(new Error(`Bilen hører til pakken ${tilbud.pakke.navn}`), { statusCode: 409 });
  }

  const abonnementId = nyId();
  await d.db.insert(abonnementer).values({
    id: abonnementId,
    kundeId,
    kjoretoyId,
    pakke: input.pakke,
    tillegg: input.tillegg,
    kmPerAr: input.kmPerAr,
    manedsprisOre: tilbud.manedspris,
    status: 'venter_betaling',
    stedId: input.stedId ?? null,
    stedstype: input.stedstype,
    adresse: input.adresse ?? null,
    depositumOre: tilbud.depositum,
    kampanjekode: kampanje?.kode ?? null,
    egneDekk: input.egneDekk,
  });

  // Hvert abonnement har to sett. Kundens egne dekk blir vårt lager.
  const kundenHar: Record<OpprettAbonnement['egneDekk'], ('sommer' | 'vinter')[]> = {
    begge_sett: ['sommer', 'vinter'],
    ett_sett: [sesongFor(na) === 'vinter' ? 'vinter' : 'sommer'],
    ingen: [],
  };
  const paBilNa = sesongFor(na);
  for (const sesong of ['sommer', 'vinter'] as const) {
    const kundensEget = kundenHar[input.egneDekk].includes(sesong);
    await d.db.insert(dekksett).values({
      id: nyId(),
      abonnementId,
      sesong,
      dimensjon: bil.dimensjonFor,
      viKjopte: !kundensEget,
      status: kundensEget && sesong === paBilNa ? 'pa_bil' : 'pa_lager',
      levetidSesonger: 4,
    });
  }

  const krav = await d.betaling.krevDepositum({
    abonnementId,
    belop: tilbud.depositum,
    telefon: (await d.db.select().from(kunder).where(eq(kunder.id, kundeId)))[0]?.telefon ?? '',
    beskrivelse: `Depositum ${tilbud.pakke.navn}, ${bil.regnr}`,
  });

  await d.db.update(abonnementer).set({ betalingRef: krav.ref }).where(eq(abonnementer.id, abonnementId));
  await logg(d.db, 'abonnement.opprettet', {
    abonnementId,
    data: { pakke: input.pakke, regnr: bil.regnr, stedstype: input.stedstype, kampanje: kampanje?.kode },
  });

  return {
    abonnementId,
    manedsprisOre: tilbud.manedspris,
    depositumOre: tilbud.depositum,
    ...(krav.betalingsUrl ? { betalingsUrl: krav.betalingsUrl } : {}),
    betalingRef: krav.ref,
  };
}

/** Kalles fra webhooken når depositumet er betalt. Gate 2 teller disse. */
export async function bekreftDepositum(
  d: Avhengigheter,
  abonnementId: string,
  na = new Date(),
): Promise<void> {
  const [abo] = await d.db.select().from(abonnementer).where(eq(abonnementer.id, abonnementId));
  if (!abo || abo.depositumBetalt) return;

  const bindingSlutt = new Date(na);
  bindingSlutt.setUTCMonth(bindingSlutt.getUTCMonth() + VILKAR.bindingManeder);

  const kampanje = await hentKampanje(d.db, abo.kampanjekode ?? undefined);
  const abo_ref = await d.betaling.startAbonnement({
    abonnementId,
    kundeRef: abo.kundeId,
    manedsprisOre: abo.manedsprisOre,
    ...(kampanje ? { gratisManeder: kampanje.gratisManeder } : {}),
    startDato: na,
  });

  await d.db.update(abonnementer).set({
    status: 'aktiv',
    depositumBetalt: na,
    startet: na,
    bindingSlutt,
    betalingRef: abo_ref.ref,
  }).where(eq(abonnementer.id, abonnementId));

  if (kampanje) {
    await d.db.update(kampanjekoder)
      .set({ bruktAntall: sql`${kampanjekoder.bruktAntall} + 1` })
      .where(eq(kampanjekoder.kode, kampanje.kode));
  }

  // Egen kode kunden kan gi til naboen. Begge får én måned gratis.
  const kode = nyKampanjekode();
  await d.db.insert(kampanjekoder).values({
    kode, eierKundeId: abo.kundeId, gratisManeder: 1, kilde: 'nabo', maksBruk: 10,
  });

  const [kunde] = await d.db.select().from(kunder).where(eq(kunder.id, abo.kundeId));
  const vindu = nesteVindu(na);
  if (kunde) {
    await d.sms.send({
      til: kunde.telefon,
      type: 'depositum.betalt',
      tekst: MELDINGER.depositumMottatt(norskDato(vindu.start)),
    });
    await d.sms.send({ til: kunde.telefon, type: 'kampanjekode', tekst: MELDINGER.kampanjekode(kode) });
  }

  await d.db.update(reservasjoner).set({ abonnementId })
    .where(eq(reservasjoner.telefon, kunde?.telefon ?? ''));

  await logg(d.db, 'depositum.betalt', { abonnementId, data: { belop: abo.depositumOre, kode } });
}

export async function endreTillegg(
  d: Avhengigheter,
  abonnementId: string,
  nyeTillegg: TilleggId[],
): Promise<{ manedsprisOre: Ore }> {
  const [abo] = await d.db.select().from(abonnementer).where(eq(abonnementer.id, abonnementId));
  if (!abo) throw Object.assign(new Error('Ukjent abonnement'), { statusCode: 404 });

  const grunnpris = PAKKER[abo.pakke].pris;
  const manedlige = nyeTillegg.filter((t) => TILLEGG[t].type === 'mnd');
  const manedspris = grunnpris + manedlige.reduce((s, t) => s + TILLEGG[t].pris, 0);

  await d.db.update(abonnementer).set({ tillegg: nyeTillegg, manedsprisOre: manedspris })
    .where(eq(abonnementer.id, abonnementId));
  await logg(d.db, 'abonnement.tillegg_endret', { abonnementId, data: { tillegg: nyeTillegg } });
  return { manedsprisOre: manedspris };
}

export interface Oppsigelse {
  bindingSlutt: Date | null;
  iBinding: boolean;
  utkjopOre: Ore;
  sisteDag: Date;
}

/** Oppsigelse. I bindingstiden kjøper kunden ut restverdien av dekk vi har kjøpt. */
export async function beregnOppsigelse(
  db: Db, abonnementId: string, na = new Date(),
): Promise<Oppsigelse> {
  const [abo] = await db.select().from(abonnementer).where(eq(abonnementer.id, abonnementId));
  if (!abo) throw Object.assign(new Error('Ukjent abonnement'), { statusCode: 404 });

  const sett = await db.select().from(dekksett).where(eq(dekksett.abonnementId, abonnementId));
  const iBinding = !!abo.bindingSlutt && abo.bindingSlutt > na;
  const utkjopOre = iBinding
    ? utkjopRestverdi(sett.map((s) => ({
        viKjopte: s.viKjopte,
        innkjopsprisEksMva: s.innkjopsprisOre ?? 0,
        brukteSesonger: s.brukteSesonger,
        levetidSesonger: s.levetidSesonger,
      })))
    : 0;

  const sisteDag = new Date(na);
  sisteDag.setUTCMonth(sisteDag.getUTCMonth() + 1);

  return { bindingSlutt: abo.bindingSlutt ?? null, iBinding, utkjopOre, sisteDag };
}

export async function sigOpp(
  d: Avhengigheter, abonnementId: string, na = new Date(),
): Promise<Oppsigelse> {
  const resultat = await beregnOppsigelse(d.db, abonnementId, na);
  const [abo] = await d.db.select().from(abonnementer).where(eq(abonnementer.id, abonnementId));
  if (!abo) throw Object.assign(new Error('Ukjent abonnement'), { statusCode: 404 });

  if (resultat.utkjopOre > 0) {
    await d.betaling.krevEngangsbelop(abo.kundeId, resultat.utkjopOre, 'Utkjøp av restverdi på dekk');
  }
  if (abo.betalingRef) await d.betaling.avsluttAbonnement(abo.betalingRef, resultat.sisteDag);

  await d.db.update(abonnementer).set({ status: 'oppsagt', oppsagt: na })
    .where(eq(abonnementer.id, abonnementId));
  await logg(d.db, 'abonnement.oppsagt', {
    abonnementId,
    data: { iBinding: resultat.iBinding, utkjopOre: resultat.utkjopOre },
  });
  return resultat;
}

/** Full oversikt til appens hovedskjerm. */
export async function hentOversikt(db: Db, abonnementId: string, na = new Date()) {
  const [abo] = await db.select().from(abonnementer).where(eq(abonnementer.id, abonnementId));
  if (!abo) return null;
  const [bil] = await db.select().from(kjoretoy).where(eq(kjoretoy.id, abo.kjoretoyId));
  const sett = await db.select().from(dekksett).where(eq(dekksett.abonnementId, abonnementId));

  const sesong = sesongFor(na);
  const paBil = sett.find((s) => s.status === 'pa_bil') ?? sett.find((s) => s.sesong === sesong);

  let monster: { tekst: string; naMm: number; sesongerIgjen: number; brukt: number; byttesAnslag: string } | null = null;
  if (paBil) {
    const rader = await db.select().from(malinger)
      .where(eq(malinger.dekksettId, paBil.id))
      .orderBy(desc(malinger.maltDato)).limit(2);
    const tilMaling = (r: typeof rader[number]): Maling => ({
      dekksettId: r.dekksettId, kmStand: r.kmStand, maltDato: r.maltDato, hjul: r.hjul,
    });
    const siste = rader[0];
    if (siste) {
      const forrige = rader[1];
      const rate = forrige ? slitasjerate(tilMaling(forrige), tilMaling(siste)) : null;
      const p = prognose({
        sisteMaling: tilMaling(siste),
        sesong: paBil.sesong,
        rate,
        kmPerAr: abo.kmPerAr,
        ...(bil?.vektKg ? { vektKg: bil.vektKg } : {}),
        na,
      });
      monster = {
        tekst: monsterTekst(p),
        naMm: p.naMm,
        sesongerIgjen: p.sesongerIgjen,
        brukt: p.brukt,
        byttesAnslag: p.byttesAnslag.toISOString().slice(0, 10),
      };
    }
  }

  return {
    abonnement: {
      id: abo.id, pakke: abo.pakke, pakkenavn: PAKKER[abo.pakke].navn, status: abo.status,
      manedsprisOre: abo.manedsprisOre, tillegg: abo.tillegg, kmPerAr: abo.kmPerAr,
      bindingSlutt: abo.bindingSlutt, startet: abo.startet, stedstype: abo.stedstype,
    },
    kjoretoy: bil ?? null,
    sett: sett.map((s) => ({
      id: s.id, sesong: s.sesong, status: s.status, viKjopte: s.viKjopte,
      brukteSesonger: s.brukteSesonger, levetidSesonger: s.levetidSesonger, lagerplass: s.lagerplass,
    })),
    sesongNa: sesong,
    monster,
    nesteVindu: (() => {
      const v = nesteVindu(na);
      return { monterer: v.monterer, start: v.start.toISOString().slice(0, 10), slutt: v.slutt.toISOString().slice(0, 10) };
    })(),
  };
}

const MANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
export const norskDato = (d: Date): string => `${d.getUTCDate()}. ${MANEDER[d.getUTCMonth()]}`;
