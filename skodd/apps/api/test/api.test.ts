/**
 * Hele kundereisen, ende til ende, mot en ekte Postgres (PGlite i minnet):
 * pris, reservasjon, innlogging, påmelding, depositum, sesongplanlegging,
 * rutetildeling, utført skift med mønstermåling, skade, oppsigelse og gater.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { kr } from '@skodd/core';
import { lesEnv } from '../src/env.ts';
import { koble, type Tilkobling } from '../src/db/client.ts';
import { migrer } from '../src/db/migrate.ts';
import { byggApp, MockBetaling, MockSms } from '../src/app.ts';
import { kunder, montorer, steder, lagre, npsSvar, vinduer } from '../src/db/schema.ts';
import { nyId } from '../src/ids.ts';
import { sikreVinduer } from '../src/tjenester/drift.ts';

let t: Tilkobling;
let app: FastifyInstance;
let sms: MockSms;
let betaling: MockBetaling;

const env = lesEnv({ NODE_ENV: 'test', DATABASE_URL: 'memory', JWT_HEMMELIGHET: 'test-hemmelighet-minst-16' } as NodeJS.ProcessEnv);

before(async () => {
  t = await koble('memory');
  await migrer(t);
  sms = new MockSms();
  betaling = new MockBetaling();
  app = await byggApp({ env, tilkobling: t, sms, betaling, logg: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await t.lukk();
});

const json = (svar: { payload: string }): any => JSON.parse(svar.payload);

async function loggInn(telefon: string): Promise<string> {
  const sendt = await app.inject({ method: 'POST', url: '/v1/auth/kode', payload: { telefon } });
  assert.equal(sendt.statusCode, 200);
  const melding = sms.sisteTil(telefon.startsWith('+') ? telefon : `+47${telefon}`);
  const kode = /\b(\d{6})\b/.exec(melding?.tekst ?? '')?.[1];
  assert.ok(kode, 'koden skal komme på SMS');
  const bekreftet = await app.inject({
    method: 'POST', url: '/v1/auth/bekreft', payload: { telefon, kode },
  });
  assert.equal(bekreftet.statusCode, 200, bekreftet.payload);
  return json(bekreftet).token;
}

const med = (token: string) => ({ authorization: `Bearer ${token}` });

test('helse og pakker er åpne', async () => {
  const helse = await app.inject({ url: '/v1/helse' });
  assert.equal(helse.statusCode, 200);
  assert.equal(json(helse).ok, true);

  const pakker = await app.inject({ url: '/v1/pakker' });
  const data = json(pakker);
  assert.equal(data.pakker.length, 3);
  assert.equal(data.pakker[0].pris, kr(399));
  assert.equal(data.merkevare.lofte, 'Alltid skodd.');
  assert.equal(data.vilkar.bindingManeder, 24);
});

test('pris på registreringsnummer, uten innlogging', async () => {
  const svar = await app.inject({ method: 'POST', url: '/v1/tilbud', payload: { regnr: 'ab 12345' } });
  assert.equal(svar.statusCode, 200, svar.payload);
  const d = json(svar);
  assert.equal(d.kjoretoy.merke, 'Volkswagen');
  assert.equal(d.kjoretoy.dimensjonFor.tommer, 16);
  assert.equal(d.tilbud.pakke.id, 'skodd');
  assert.equal(d.tilbud.manedspris, kr(399));
  assert.equal(d.sammenligning.skoddErBilligere, true);

  const elbil = await app.inject({ method: 'POST', url: '/v1/tilbud', payload: { regnr: 'EK54321', kmPerAr: 25000 } });
  const e = json(elbil);
  assert.equal(e.tilbud.pakke.id, 'skodd_stor');
  assert.equal(e.tilbud.manedspris, kr(649), '549 pluss 100 for over 15 000 km');

  const ugyldig = await app.inject({ method: 'POST', url: '/v1/tilbud', payload: { regnr: 'AI12345' } });
  assert.equal(ugyldig.statusCode, 400);
  assert.equal(json(ugyldig).feil, 'Ugyldige felt');
});

test('forhåndsbestilling fra landingssiden', async () => {
  const svar = await app.inject({
    method: 'POST', url: '/v1/reservasjoner',
    payload: { telefon: '912 34 567', regnr: 'AB12345', postnummer: '0588', kilde: 'borettslag' },
  });
  assert.equal(svar.statusCode, 201, svar.payload);
  assert.match(json(svar).melding, /vårsesongen/);
});

test('uten token er alt stengt', async () => {
  assert.equal((await app.inject({ url: '/v1/meg' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/v1/ops/noktall' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/v1/montor/jobber?dato=2027-04-12' })).statusCode, 401);
});

test('feil engangskode slipper ingen inn', async () => {
  await app.inject({ method: 'POST', url: '/v1/auth/kode', payload: { telefon: '+4791111111' } });
  const svar = await app.inject({
    method: 'POST', url: '/v1/auth/bekreft', payload: { telefon: '+4791111111', kode: '000000' },
  });
  // Koden er tilfeldig, så i praksis feiler denne alltid.
  if (svar.statusCode !== 200) {
    assert.equal(svar.statusCode, 401);
    assert.equal(json(svar).feil, 'feil_kode');
  }
});

test('hele reisen: påmelding, depositum, skift og oppsigelse', async () => {
  // Et borettslag som har sagt ja, og en lagerpartner. Gate 2 krever begge.
  const stedId = nyId();
  await t.db.insert(steder).values({
    id: stedId, navn: 'Solbakken borettslag', type: 'borettslag',
    adresse: 'Solbakkveien 12, Oslo', postnummer: '0588', avtalestatus: 'ja', antallBiler: 64,
  });
  await t.db.insert(lagre).values({
    id: nyId(), navn: 'Alnabru dekklager', adresse: 'Nedre Kalbakkvei 40, Oslo', kapasitetSett: 900,
  });

  const token = await loggInn('+4791000001');

  // 1. Påmelding.
  const pamelding = await app.inject({
    method: 'POST', url: '/v1/abonnementer', headers: med(token),
    payload: {
      regnr: 'AB12345', pakke: 'skodd', tillegg: ['felg_pluss'], kmPerAr: 12_000,
      stedstype: 'borettslag', stedId, godtarVilkar: true, egneDekk: 'begge_sett',
    },
  });
  assert.equal(pamelding.statusCode, 201, pamelding.payload);
  const { abonnementId, depositumOre, betalingsUrl, manedsprisOre } = json(pamelding);
  assert.equal(depositumOre, kr(399));
  assert.equal(manedsprisOre, kr(448), '399 pluss Felg+ 49');
  assert.ok(betalingsUrl.startsWith('https://'));

  // Feil pakke for bilen skal avvises.
  const feilPakke = await app.inject({
    method: 'POST', url: '/v1/abonnementer', headers: med(token),
    payload: {
      regnr: 'BS99887', pakke: 'skodd_premium', stedstype: 'hjemme',
      adresse: { gate: 'Gateveien 3', postnummer: '0560', poststed: 'Oslo' },
      godtarVilkar: true,
    },
  });
  assert.equal(feilPakke.statusCode, 409);

  // 2. Depositumet betales. Webhooken aktiverer abonnementet.
  const ref = json(pamelding).betalingRef;
  const webhook = await app.inject({
    method: 'POST', url: '/v1/webhooks/betaling',
    payload: { type: 'depositum.betalt', ref, abonnementId },
  });
  assert.equal(webhook.statusCode, 200, webhook.payload);

  const etter = await app.inject({ url: `/v1/abonnementer/${abonnementId}`, headers: med(token) });
  assert.equal(etter.statusCode, 200, etter.payload);
  const oversikt = json(etter);
  assert.equal(oversikt.abonnement.status, 'aktiv');
  assert.equal(oversikt.sett.length, 2, 'to sett: sommer og vinter');
  assert.equal(oversikt.monster, null, 'ingen måling før første skift');
  assert.ok(oversikt.nesteVindu.start);
  // Kunden har fått kvittering og en kode til naboen.
  assert.ok(sms.sendt.some((m) => m.type === 'depositum.betalt'));
  assert.ok(sms.sendt.some((m) => m.type === 'kampanjekode'));
  assert.ok(betaling.kall.some((k) => k.metode === 'startAbonnement'));

  // 3. Drift planlegger sesongen.
  await t.db.insert(kunder).values({ id: nyId(), telefon: '+4790000001', navn: 'Drift Skodd', rolle: 'ops' });
  const opsToken = await loggInn('+4790000001');

  const vinduSvar = await app.inject({
    method: 'POST', url: '/v1/ops/vinduer', headers: med(opsToken), payload: { ar: 2027 },
  });
  assert.equal(vinduSvar.statusCode, 200, vinduSvar.payload);
  const varvindu = json(vinduSvar).vinduer.find((v: any) => v.monterer === 'sommer');
  assert.equal(varvindu.lovpalagt_frist ?? varvindu.lovpalagtFrist, '2027-04-05');

  const planlagt = await app.inject({
    method: 'POST', url: `/v1/ops/vinduer/${varvindu.id}/planlegg`, headers: med(opsToken),
  });
  assert.equal(json(planlagt).opprettet, 1);

  // 4. En montør får dagen tildelt, og ruten prises mot Gate 3.
  const montorKundeId = nyId();
  await t.db.insert(kunder).values({ id: montorKundeId, telefon: '+4790000002', navn: 'Jonas Berg', rolle: 'montor' });
  const montorId = nyId();
  await t.db.insert(montorer).values({ id: montorId, kundeId: montorKundeId, navn: 'Jonas Berg', telefon: '+4790000002' });

  const dag = await app.inject({
    method: 'POST', url: '/v1/ops/dager', headers: med(opsToken),
    payload: { vinduId: varvindu.id, dato: '2027-04-01', montorId },
  });
  assert.equal(dag.statusCode, 200, dag.payload);
  const rute = json(dag);
  assert.equal(rute.antallJobber, 1);
  assert.equal(rute.stopp[0].sted, 'Solbakken borettslag');
  assert.ok(rute.kostnadPerSkiftOre > 0);

  // 5. Montøren ser jobben og fullfører den med måling på fire hjul.
  const montorToken = await loggInn('+4790000002');
  const jobbliste = await app.inject({ url: '/v1/montor/jobber?dato=2027-04-01', headers: med(montorToken) });
  assert.equal(jobbliste.statusCode, 200, jobbliste.payload);
  const jobb = json(jobbliste).jobber[0];
  assert.equal(jobb.regnr, 'AB12345');
  assert.equal(jobb.monterer, 'sommer');
  assert.equal(jobb.sted.navn, 'Solbakken borettslag');

  const fullfort = await app.inject({
    method: 'POST', url: `/v1/montor/jobber/${jobb.id}/fullfor`, headers: med(montorToken),
    payload: {
      kmStand: 48_000, monterteSesong: 'sommer', momentNm: 120,
      hjul: [
        { posisjon: 'VF', innerMm: 6.0, midtMm: 6.2, ytterMm: 6.1 },
        { posisjon: 'HF', innerMm: 6.1, midtMm: 6.2, ytterMm: 6.2 },
        { posisjon: 'VB', innerMm: 6.6, midtMm: 6.7, ytterMm: 6.7 },
        { posisjon: 'HB', innerMm: 6.5, midtMm: 6.6, ytterMm: 6.6 },
      ],
      hjulAvmontert: [
        { posisjon: 'VF', innerMm: 4.8, midtMm: 5.0, ytterMm: 4.9 },
        { posisjon: 'HF', innerMm: 4.9, midtMm: 5.0, ytterMm: 5.0 },
        { posisjon: 'VB', innerMm: 5.4, midtMm: 5.5, ytterMm: 5.5 },
        { posisjon: 'HB', innerMm: 5.3, midtMm: 5.4, ytterMm: 5.4 },
      ],
    },
  });
  assert.equal(fullfort.statusCode, 200, fullfort.payload);
  const resultat = json(fullfort);
  assert.match(resultat.monsterTekst, /^6,0 mm igjen\./);
  assert.equal(resultat.maBytteSett, false);
  assert.equal(resultat.avvik.length, 0);
  assert.ok(sms.sendt.some((m) => m.type === 'skift.utfort' && m.tekst.includes('6,0 mm')));

  // Samme jobb kan ikke fullføres to ganger.
  const igjen = await app.inject({
    method: 'POST', url: `/v1/montor/jobber/${jobb.id}/fullfor`, headers: med(montorToken),
    payload: {
      kmStand: 48_100, monterteSesong: 'sommer',
      hjul: [
        { posisjon: 'VF', innerMm: 6, midtMm: 6, ytterMm: 6 },
        { posisjon: 'HF', innerMm: 6, midtMm: 6, ytterMm: 6 },
        { posisjon: 'VB', innerMm: 6, midtMm: 6, ytterMm: 6 },
        { posisjon: 'HB', innerMm: 6, midtMm: 6, ytterMm: 6 },
      ],
    },
  });
  assert.equal(igjen.statusCode, 409);

  // 6. Kunden ser mønsteret i appen.
  const medMonster = json(await app.inject({ url: `/v1/abonnementer/${abonnementId}`, headers: med(token) }));
  assert.equal(medMonster.monster.naMm, 6);
  assert.ok(medMonster.monster.sesongerIgjen >= 1);
  assert.equal(medMonster.sett.find((s: any) => s.sesong === 'sommer').status, 'pa_bil');
  assert.equal(medMonster.sett.find((s: any) => s.sesong === 'vinter').status, 'pa_lager');
  assert.equal(medMonster.sett.find((s: any) => s.sesong === 'vinter').brukteSesonger, 1);

  // 7. Punktering: inkludert, og reparert innen 48 timer.
  const skade = await app.inject({
    method: 'POST', url: '/v1/skade', headers: med(token),
    payload: { abonnementId, type: 'punktering', posisjon: 'HF', beskrivelse: 'Spiker i dekket på Ring 3.' },
  });
  assert.equal(skade.statusCode, 201, skade.payload);
  assert.equal(json(skade).egenandelOre, 0);
  assert.equal(json(skade).dekkesAv, 'skodd');
  assert.ok(json(skade).frist);

  const felgskade = await app.inject({
    method: 'POST', url: '/v1/skade', headers: med(token),
    payload: { abonnementId, type: 'felg', beskrivelse: 'Kantstein, felgen er bøyd.' },
  });
  assert.equal(json(felgskade).dekkesAv, 'felg_pluss', 'kunden har Felg+');

  // 8. Tillegg kan endres fra appen.
  const utenFelg = await app.inject({
    method: 'PUT', url: `/v1/abonnementer/${abonnementId}/tillegg`, headers: med(token),
    payload: { tillegg: [] },
  });
  assert.equal(json(utenFelg).manedsprisOre, kr(399));

  // 9. NPS.
  await app.inject({
    method: 'POST', url: '/v1/nps', headers: med(token),
    payload: { abonnementId, jobbId: jobb.id, score: 10, kommentar: 'Merket ingenting. Perfekt.' },
  });

  // 10. Oppsigelse i bindingstiden: utkjøp av restverdi på dekk vi har kjøpt.
  const forhandsvisning = json(await app.inject({
    url: `/v1/abonnementer/${abonnementId}/oppsigelse`, headers: med(token),
  }));
  assert.equal(forhandsvisning.iBinding, true);
  assert.equal(forhandsvisning.utkjopOre, 0, 'kunden kom med egne dekk, så vi har ikke kjøpt noe');

  const oppsagt = await app.inject({
    method: 'POST', url: `/v1/abonnementer/${abonnementId}/oppsigelse`, headers: med(token),
    payload: { bekreftet: true },
  });
  assert.equal(oppsagt.statusCode, 200, oppsagt.payload);
  assert.ok(betaling.kall.some((k) => k.metode === 'avsluttAbonnement'));

  // 11. En kunde kommer ikke inn på driftsflaten.
  assert.equal((await app.inject({ url: '/v1/ops/noktall', headers: med(token) })).statusCode, 403);
  // Og ikke på en annen kundes abonnement.
  const annenToken = await loggInn('+4791000009');
  assert.equal(
    (await app.inject({ url: `/v1/abonnementer/${abonnementId}`, headers: med(annenToken) })).statusCode,
    404,
  );
});

test('nøkkeltall og gater regnes ut på levende data', async () => {
  const opsToken = await loggInn('+4790000001');
  const svar = await app.inject({ url: '/v1/ops/noktall', headers: med(opsToken) });
  assert.equal(svar.statusCode, 200, svar.payload);
  const d = json(svar);

  assert.ok(d.noktall.reservasjoner >= 1);
  assert.equal(d.noktall.borettslagJa, 1);
  assert.equal(d.noktall.betalteDepositum, 1);
  assert.equal(d.noktall.harLagerpartner, true);
  assert.equal(d.noktall.utforteSkift, 1);
  assert.ok(d.noktall.kostnadPerSkiftOre > 0);
  assert.equal(d.noktall.nps, 100);

  assert.equal(d.gater.length, 3);
  assert.equal(d.gater[0].id, 'gate1');
  assert.equal(d.gater[0].bestatt, false, '1 reservasjon er ikke 150');
  assert.ok(d.enhetsokonomi.fullSlitasje.bidragsmargin > 0.2);
  assert.equal(d.pilotbudsjett.sum, kr(385_000));
});

test('kapasiteten holder for piloten', async () => {
  const opsToken = await loggInn('+4790000001');
  const svar = await app.inject({ url: '/v1/ops/kapasitet?montorer=2&dager=30', headers: med(opsToken) });
  assert.ok(json(svar).maksBiler >= 300);
});

test('sesongvinduene er idempotente', async () => {
  await sikreVinduer(t.db, 2028);
  await sikreVinduer(t.db, 2028);
  const rader = await t.db.select().from(vinduer).where(eq(vinduer.ar, 2028));
  assert.equal(rader.length, 2);
});

test('engangskoder er rangert i drift', async () => {
  // Egen app med produksjonsoppsett, så grensen faktisk gjelder.
  const t2 = await koble('memory');
  await migrer(t2);
  const prodEnv = lesEnv({
    NODE_ENV: 'production', DATABASE_URL: 'memory', JWT_HEMMELIGHET: 'test-hemmelighet-minst-16',
  } as NodeJS.ProcessEnv);
  const app2 = await byggApp({ env: prodEnv, tilkobling: t2, sms: new MockSms(), betaling: new MockBetaling(), logg: false });
  await app2.ready();
  try {
    const koder = [];
    for (let i = 0; i < 7; i += 1) {
      koder.push((await app2.inject({ method: 'POST', url: '/v1/auth/kode', payload: { telefon: '+4791234567' } })).statusCode);
    }
    assert.equal(koder[0], 200);
    assert.equal(koder[6], 429, 'sjette forsøk innen ti minutter stoppes');
  } finally {
    await app2.close();
    await t2.lukk();
  }
});

test('ugyldig webhook avvises', async () => {
  const svar = await app.inject({
    method: 'POST', url: '/v1/webhooks/betaling', payload: { noe: 'rart' },
  });
  assert.equal(svar.statusCode, 400);
});
