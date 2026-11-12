/**
 * Testdata for utvikling og demo: ett borettslag, én arbeidsplass, en
 * lagerpartner, en montør, en driftsbruker og tre kunder med abonnement.
 */
import { lesEnv } from '../env.ts';
import { koble } from './client.ts';
import { migrer } from './migrate.ts';
import { kunder, montorer, steder, lagre, kampanjekoder } from './schema.ts';
import { nyId } from '../ids.ts';
import { sikreVinduer } from '../tjenester/drift.ts';
import { FalskKjoretoyregister, MockBetaling, MockSms } from '../adapters/index.ts';
import { bekreftDepositum, meldPa } from '../tjenester/abonnement.ts';
import { planleggSesong } from '../tjenester/drift.ts';
import { eq } from 'drizzle-orm';
import { vinduer } from './schema.ts';

const env = lesEnv();
const t = await koble(env.DATABASE_URL);
await migrer(t);
const db = t.db;

const ar = new Date().getUTCFullYear();
await sikreVinduer(db, ar);
await sikreVinduer(db, ar + 1);

const solbakken = nyId();
const kontorbygg = nyId();
await db.insert(steder).values([
  {
    id: solbakken, navn: 'Solbakken borettslag', type: 'borettslag',
    adresse: 'Solbakkveien 12, 0588 Oslo', postnummer: '0588',
    avtalestatus: 'ja', antallBiler: 64, kontakt: 'Styreleder Anne Rygh',
  },
  {
    id: kontorbygg, navn: 'Nydalen Næringspark', type: 'arbeidsplass',
    adresse: 'Gjerdrums vei 8, 0484 Oslo', postnummer: '0484',
    avtalestatus: 'i_dialog', antallBiler: 120, kontakt: 'HR, Kari Lie',
  },
]);

await db.insert(lagre).values({
  id: nyId(), navn: 'Alnabru dekklager', adresse: 'Nedre Kalbakkvei 40, 0953 Oslo',
  partner: 'Dekkhotell Øst AS', hyllemeter: 180, kapasitetSett: 900,
  prisPerSettArOre: 20_000,
});

const opsId = nyId();
const montorKundeId = nyId();
await db.insert(kunder).values([
  { id: opsId, telefon: '+4790000001', navn: 'Drift Skodd', rolle: 'ops' },
  { id: montorKundeId, telefon: '+4790000002', navn: 'Jonas Berg', rolle: 'montor' },
]);
const montorId = nyId();
await db.insert(montorer).values({
  id: montorId, kundeId: montorKundeId, navn: 'Jonas Berg', telefon: '+4790000002',
});

await db.insert(kampanjekoder).values({
  kode: 'SOLBAKKEN', gratisManeder: 1, kilde: 'borettslag', maksBruk: 100,
});

const d = {
  db, register: new FalskKjoretoyregister(), betaling: new MockBetaling(), sms: new MockSms(),
};

const kundeliste = [
  { telefon: '+4791000001', navn: 'Ida Moen', regnr: 'AB12345', pakke: 'skodd' as const },
  { telefon: '+4791000002', navn: 'Petter Dahl', regnr: 'EK54321', pakke: 'skodd_stor' as const },
  { telefon: '+4791000003', navn: 'Sara Nygård', regnr: 'CV45678', pakke: 'skodd_premium' as const },
];

for (const k of kundeliste) {
  const kundeId = nyId();
  await db.insert(kunder).values({ id: kundeId, telefon: k.telefon, navn: k.navn });
  const { abonnementId } = await meldPa(d, kundeId, {
    regnr: k.regnr, pakke: k.pakke, tillegg: [], kmPerAr: 15_000,
    stedstype: 'borettslag', stedId: solbakken, godtarVilkar: true, egneDekk: 'begge_sett',
    kampanjekode: 'SOLBAKKEN',
  });
  await bekreftDepositum(d, abonnementId);
}

const [vindu] = await db.select().from(vinduer).where(eq(vinduer.ar, ar + 1));
if (vindu) await planleggSesong(db, vindu.id);

console.log('Testdata lagt inn.');
console.log(`  Driftsbruker:  +4790000001 (rolle ops)`);
console.log(`  Montør:        +4790000002 (rolle montor)`);
console.log(`  Kunder:        ${kundeliste.map((k) => k.telefon).join(', ')}`);
console.log(`  Borettslag:    Solbakken (${solbakken})`);
await t.lukk();
