import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eksMva, inklMva, kr, formatKr, tilKroner,
  paskedag, andrePaskedag, piggfrist, piggErLov, sesongFor, skiftvinduer, nesteVindu, aksentSesong,
  normaliserRegnr, erGyldigRegnr, visRegnr, parseDimensjon, visDimensjon, UgyldigRegnr,
  lagTilbud, velgPakke, PAKKER, VILKAR, sammenlignMedIDag, utkjopRestverdi,
  settMinMm, slitasjerate, prognose, monsterTekst, finnAvvik, SKODD_GRENSE_MM, type Maling,
  planleggRute, bestarGate3, kapasitet, minutterForJobb, type Sted, type Jobb,
  enhetsokonomi, pilotbudsjett, arligInntektEksMva,
  vurderGate, type Noktall,
  tilbudForesporselSchema, telefonSchema, fullforJobbSchema,
} from '../src/index.ts';

test('mva regnes begge veier uten å drive', () => {
  assert.equal(eksMva(kr(399)), kr(319.2));
  assert.equal(inklMva(eksMva(kr(399))), kr(399));
  assert.equal(formatKr(kr(4788)), '4 788 kr');
  assert.equal(tilKroner(kr(399)), 399);
});

test('påske og piggfrist', () => {
  // Påskedag 2027 er 28. mars, 2. påskedag 29. mars.
  assert.equal(paskedag(2027).toISOString().slice(0, 10), '2027-03-28');
  assert.equal(andrePaskedag(2027).toISOString().slice(0, 10), '2027-03-29');
  // Første mandag etter 2. påskedag.
  assert.equal(piggfrist(2027).toISOString().slice(0, 10), '2027-04-05');
  assert.equal(paskedag(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(piggfrist(2026).toISOString().slice(0, 10), '2026-04-13');
  // Nord-Norge har faste datoer.
  assert.equal(piggfrist(2027, 'nord').toISOString().slice(0, 10), '2027-04-30');
});

test('sesong og aksentfarge følger kalenderen', () => {
  assert.equal(piggErLov(new Date('2027-01-10T00:00:00Z')), true);
  assert.equal(piggErLov(new Date('2027-06-01T00:00:00Z')), false);
  assert.equal(sesongFor(new Date('2027-12-01T00:00:00Z')), 'vinter');
  assert.equal(sesongFor(new Date('2027-07-01T00:00:00Z')), 'sommer');
  assert.equal(aksentSesong(new Date('2027-02-01T00:00:00Z')), 'is');
  assert.equal(aksentSesong(new Date('2027-05-01T00:00:00Z')), 'sol');
});

test('skiftvinduene er seks uker og ender på fristen', () => {
  const [var_, host] = skiftvinduer(2027);
  assert.equal(var_.monterer, 'sommer');
  assert.equal(host.monterer, 'vinter');
  const uker = (var_.slutt.getTime() - var_.start.getTime()) / 86_400_000 / 7;
  assert.equal(uker, 6);
  assert.ok(var_.lovpalagtFrist! <= var_.slutt);
  const neste = nesteVindu(new Date('2027-01-05T00:00:00Z'));
  assert.equal(neste.monterer, 'sommer');
  const etterVar = nesteVindu(new Date('2027-06-01T00:00:00Z'));
  assert.equal(etterVar.monterer, 'vinter');
});

test('registreringsnummer og dimensjon', () => {
  assert.equal(normaliserRegnr('ab 12345'), 'AB12345');
  assert.equal(visRegnr('EK54321'), 'EK 54321');
  assert.equal(erGyldigRegnr('AI12345'), false, 'I brukes ikke på norske skilt');
  assert.equal(erGyldigRegnr('AB1234'), false);
  assert.throws(() => normaliserRegnr('xx'), UgyldigRegnr);
  const d = parseDimensjon('225/45R18 95Y');
  assert.deepEqual(d, { bredde: 225, profil: 45, tommer: 18, lastindeks: 95, hastighetsindeks: 'Y' });
  assert.equal(visDimensjon(d), '225/45R18 95Y');
  assert.equal(parseDimensjon('195/65 R 15').tommer, 15);
});

test('pakkevalg og tilbud', () => {
  assert.equal(velgPakke({ bredde: 195, profil: 65, tommer: 15 }).id, 'skodd');
  assert.equal(velgPakke({ bredde: 235, profil: 50, tommer: 19 }).id, 'skodd_stor');
  assert.equal(velgPakke({ bredde: 265, profil: 35, tommer: 21 }).id, 'skodd_premium');
  assert.equal(velgPakke({ bredde: 225, profil: 45, tommer: 17 }, 'ytelsesbil').id, 'skodd_premium');

  const t = lagTilbud({ dimensjon: { bredde: 195, profil: 65, tommer: 16 } });
  assert.equal(t.manedspris, kr(399));
  assert.equal(t.arspris, kr(4788));
  assert.equal(t.bindingManeder, 24);
  assert.equal(t.depositum, kr(399));

  const mye = lagTilbud({ dimensjon: { bredde: 235, profil: 45, tommer: 19 }, kmPerAr: 25_000 });
  assert.equal(mye.manedspris, kr(649), '549 + 100 for over 15 000 km');

  const andreBil = lagTilbud({ dimensjon: { bredde: 195, profil: 65, tommer: 16 }, flerbil: true });
  assert.equal(andreBil.manedspris, kr(319.2));

  const medFelg = lagTilbud({ dimensjon: { bredde: 225, profil: 45, tommer: 18 }, tillegg: ['felg_pluss'] });
  assert.equal(medFelg.manedspris, kr(598));
});

test('salgsargumentet holder mot anslagene i konseptet', () => {
  const t = lagTilbud({ dimensjon: { bredde: 195, profil: 65, tommer: 16 } });
  const s = sammenlignMedIDag(t);
  assert.equal(s.dekkslitasjePerAr, kr(3500));
  assert.equal(s.dagensKostnadPerAr, kr(6000));
  assert.equal(s.skoddPerAr, kr(4788));
  assert.equal(s.skoddErBilligere, true);
  assert.equal(s.differanse, kr(1212));
});

test('utkjøp dekker bare dekk vi har kjøpt', () => {
  const sum = utkjopRestverdi([
    { viKjopte: true, innkjopsprisEksMva: kr(3500), brukteSesonger: 1, levetidSesonger: 4 },
    { viKjopte: false, innkjopsprisEksMva: kr(3500), brukteSesonger: 0, levetidSesonger: 4 },
  ]);
  assert.equal(sum, kr(2625));
  assert.equal(utkjopRestverdi([{ viKjopte: true, innkjopsprisEksMva: kr(3500), brukteSesonger: 9, levetidSesonger: 4 }]), 0);
});

const maling = (km: number, mm: number, dato: string): Maling => ({
  dekksettId: 'sett-1',
  kmStand: km,
  maltDato: new Date(dato),
  hjul: (['VF', 'HF', 'VB', 'HB'] as const).map((posisjon) => ({
    posisjon, innerMm: mm, midtMm: mm + 0.2, ytterMm: mm + 0.1,
  })),
});

test('slitasjerate og prognose', () => {
  const a = maling(40_000, 7.0, '2026-04-10T08:00:00Z');
  const b = maling(48_000, 6.2, '2027-04-10T08:00:00Z');
  assert.equal(settMinMm(b), 6.2);
  const rate = slitasjerate(a, b)!;
  assert.equal(Math.round(rate.mmPer1000Km * 1000) / 1000, 0.1);
  assert.equal(rate.sikker, true);
  assert.equal(slitasjerate(b, a), null, 'kilometerstand kan ikke gå ned');

  const p = prognose({ sisteMaling: b, sesong: 'sommer', rate, kmPerAr: 15_000 });
  // 6,2 mm ned til grensen 3,0 mm med 0,1 mm per 1000 km gir 32 000 km.
  assert.equal(p.kmIgjen, 32_000);
  assert.equal(p.sesongerIgjen, 4);
  assert.equal(p.maBytteNa, false);
  assert.ok(p.brukt > 0 && p.brukt < 1);

  const slitt = prognose({ sisteMaling: maling(90_000, SKODD_GRENSE_MM.sommer - 0.1, '2027-04-10T08:00:00Z'), sesong: 'sommer' });
  assert.equal(slitt.maBytteNa, true);
  assert.equal(slitt.kmIgjen, 0);
});

test('mønstertekst har merkevarens stemme', () => {
  const p = prognose({ sisteMaling: maling(48_000, 4.2, '2027-04-10T08:00:00Z'), sesong: 'vinter', kmPerAr: 15_000 });
  assert.match(monsterTekst(p), /^4,2 mm igjen\./);
  const slitt = prognose({ sisteMaling: maling(48_000, 2.0, '2027-04-10T08:00:00Z'), sesong: 'vinter' });
  assert.equal(monsterTekst(slitt), '2,0 mm igjen. Vi bytter settet før neste sesong.');
});

test('avvik fanger skjev slitasje og ulovlig mønster', () => {
  const m: Maling = {
    dekksettId: 's', kmStand: 50_000, maltDato: new Date('2027-04-01T00:00:00Z'),
    hjul: [
      { posisjon: 'VF', innerMm: 2.0, midtMm: 5.0, ytterMm: 5.2 },
      { posisjon: 'HF', innerMm: 4.2, midtMm: 4.3, ytterMm: 4.3 },
      { posisjon: 'VB', innerMm: 2.5, midtMm: 2.6, ytterMm: 2.6 },
      { posisjon: 'HB', innerMm: 6.0, midtMm: 6.0, ytterMm: 6.1 },
    ],
  };
  const avvik = finnAvvik(m, 'vinter');
  assert.ok(avvik.some((a) => a.posisjon === 'VF' && a.type === 'skjev_slitasje'));
  assert.ok(avvik.some((a) => a.posisjon === 'VB' && a.type === 'under_lovlig'));
  assert.ok(avvik.some((a) => a.posisjon === 'HF' && a.type === 'under_var_grense'));
  assert.equal(avvik.filter((a) => a.posisjon === 'HB').length, 0);
});

test('tetthet er det som gjør et skift billig', () => {
  const steder: Sted[] = [
    { id: 'brl', navn: 'Solbakken borettslag', type: 'borettslag', adresse: 'Solbakken 1, Oslo' },
    { id: 'h1', navn: 'Hjemme', type: 'hjemme', adresse: 'Gateveien 3, Oslo' },
  ];
  const jobb = (i: number, stedId: string): Jobb => ({
    id: `j${i}`, stedId, abonnementId: `a${i}`, regnr: 'AB12345', monterer: 'sommer', henterSett: true,
  });
  const samlet = planleggRute(Array.from({ length: 12 }, (_, i) => jobb(i, 'brl')), steder, new Date('2027-04-12T07:00:00Z'));
  const enkelt = planleggRute([jobb(99, 'h1')], steder, new Date('2027-04-12T07:00:00Z'));
  assert.ok(samlet.kostnadPerSkiftOre < enkelt.kostnadPerSkiftOre);
  assert.equal(bestarGate3(samlet), true);
  assert.equal(samlet.antallJobber, 12);
  assert.equal(minutterForJobb(1) > minutterForJobb(10), true);
  assert.ok(kapasitet(2, 30).maksBiler > 300, 'to montører i seks uker skal klare piloten');
});

test('enhetsøkonomi og pilotbudsjett', () => {
  const e = enhetsokonomi('skodd');
  assert.equal(e.inntektEksMva, kr(3830.4));
  assert.ok(e.bidragsmargin > 0.2 && e.bidragsmargin < 0.3, `margin ${e.bidragsmargin}`);
  const forsteAr = enhetsokonomi('skodd', undefined, { kundensEgneDekk: true });
  assert.ok(forsteAr.bidragsmargin > e.bidragsmargin, 'første år er bedre fordi kunden tar med egne dekk');

  const b = pilotbudsjett(300);
  assert.equal(b.sum, kr(385_000));
  assert.equal(b.arligAbonnementInklMva, kr(1_436_400));
  // Skaleringstallene i konseptet: 50 000 biler gir ca. 190 MNOK eks. mva.
  assert.ok(Math.abs(tilKroner(arligInntektEksMva(50_000)) - 191_500_000) < 1_000_000);
});

test('gatene vurderes mot nøkkeltall', () => {
  const n: Noktall = {
    reservasjoner: 151, borettslagJa: 3, betalteDepositum: 99, harLagerpartner: true,
    kostnadPerSkiftOre: kr(290), nps: 61, oppsigelsesandel: 0.08,
  };
  assert.equal(vurderGate('gate1', n).bestatt, true);
  assert.equal(vurderGate('gate2', n).bestatt, false);
  assert.equal(vurderGate('gate3', n).bestatt, true);
  assert.equal(vurderGate('gate3', { ...n, kostnadPerSkiftOre: kr(310) }).bestatt, false);
});

test('skjemaene rydder inndata fra appen', () => {
  const t = tilbudForesporselSchema.parse({ regnr: 'ab 12345' });
  assert.equal(t.regnr, 'AB12345');
  assert.equal(telefonSchema.parse('912 34 567'), '+4791234567');
  assert.equal(telefonSchema.parse('+4791234567'), '+4791234567');
  assert.throws(() => telefonSchema.parse('22334455'), /norsk mobilnummer/);
  assert.throws(() => tilbudForesporselSchema.parse({ regnr: 'AI12345' }));
  const j = fullforJobbSchema.parse({
    kmStand: 50_000, monterteSesong: 'sommer',
    hjul: (['VF', 'HF', 'VB', 'HB'] as const).map((posisjon) => ({ posisjon, innerMm: 6, midtMm: 6, ytterMm: 6 })),
  });
  assert.equal(j.bildeUrler.length, 0);
  assert.equal(j.henterSett, true);
});
