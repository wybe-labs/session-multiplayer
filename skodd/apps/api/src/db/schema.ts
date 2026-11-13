import {
  pgTable, uuid, text, integer, bigint, jsonb, boolean, timestamp, date,
  numeric, doublePrecision, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import type { Dekkdimensjon, Hjulposisjon, HjulMaling } from '@skodd/core';

const na = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const kunder = pgTable('kunder', {
  id: uuid().primaryKey(),
  telefon: text().notNull().unique(),
  navn: text(),
  epost: text(),
  rolle: text().$type<'kunde' | 'montor' | 'ops'>().notNull().default('kunde'),
  opprettet: na(),
});

export const steder = pgTable('steder', {
  id: uuid().primaryKey(),
  navn: text().notNull(),
  type: text().$type<'borettslag' | 'arbeidsplass' | 'hjemme' | 'garasjeanlegg'>().notNull(),
  adresse: text().notNull(),
  postnummer: text(),
  lat: doublePrecision(),
  lon: doublePrecision(),
  avtalestatus: text().$type<'prospekt' | 'i_dialog' | 'ja' | 'nei'>().notNull().default('prospekt'),
  antallBiler: integer('antall_biler'),
  kontakt: text(),
  opprettet: na(),
});

export const kjoretoy = pgTable('kjoretoy', {
  id: uuid().primaryKey(),
  regnr: text().notNull().unique(),
  merke: text().notNull(),
  modell: text().notNull(),
  arsmodell: integer().notNull(),
  type: text().$type<'personbil' | 'suv' | 'varebil' | 'ytelsesbil'>().notNull(),
  drivstoff: text().$type<'elektrisk' | 'hybrid' | 'bensin' | 'diesel' | 'annet'>().notNull(),
  vektKg: integer('vekt_kg'),
  dimensjonFor: jsonb('dimensjon_for').$type<Dekkdimensjon>().notNull(),
  dimensjonBak: jsonb('dimensjon_bak').$type<Dekkdimensjon>(),
  opprettet: na(),
});

export const abonnementer = pgTable('abonnementer', {
  id: uuid().primaryKey(),
  kundeId: uuid('kunde_id').notNull().references(() => kunder.id),
  kjoretoyId: uuid('kjoretoy_id').notNull().references(() => kjoretoy.id),
  pakke: text().$type<'skodd' | 'skodd_stor' | 'skodd_premium'>().notNull(),
  tillegg: jsonb().$type<string[]>().notNull().default([]),
  kmPerAr: integer('km_per_ar').notNull().default(15_000),
  manedsprisOre: bigint('manedspris_ore', { mode: 'number' }).notNull(),
  status: text()
    .$type<'reservert' | 'venter_betaling' | 'aktiv' | 'pause' | 'oppsagt' | 'avsluttet'>()
    .notNull().default('reservert'),
  stedId: uuid('sted_id').references(() => steder.id),
  stedstype: text().notNull(),
  adresse: jsonb().$type<Record<string, string>>(),
  depositumOre: bigint('depositum_ore', { mode: 'number' }).notNull().default(0),
  depositumBetalt: timestamp('depositum_betalt', { withTimezone: true }),
  betalingRef: text('betaling_ref'),
  kampanjekode: text(),
  egneDekk: text('egne_dekk').$type<'begge_sett' | 'ett_sett' | 'ingen'>().notNull().default('begge_sett'),
  startet: timestamp({ withTimezone: true }),
  bindingSlutt: timestamp('binding_slutt', { withTimezone: true }),
  oppsagt: timestamp({ withTimezone: true }),
  opprettet: na(),
}, (t) => [index('abonnementer_kunde_idx').on(t.kundeId), index('abonnementer_status_idx').on(t.status)]);

export const lagre = pgTable('lagre', {
  id: uuid().primaryKey(),
  navn: text().notNull(),
  adresse: text().notNull(),
  partner: text(),
  hyllemeter: integer().notNull().default(0),
  kapasitetSett: integer('kapasitet_sett').notNull().default(0),
  prisPerSettArOre: bigint('pris_per_sett_ar_ore', { mode: 'number' }),
  aktiv: boolean().notNull().default(true),
  opprettet: na(),
});

export const dekksett = pgTable('dekksett', {
  id: uuid().primaryKey(),
  abonnementId: uuid('abonnement_id').notNull().references(() => abonnementer.id),
  sesong: text().$type<'vinter' | 'sommer'>().notNull(),
  dimensjon: jsonb().$type<Dekkdimensjon>().notNull(),
  merke: text(),
  modell: text(),
  pigg: boolean().notNull().default(false),
  viKjopte: boolean('vi_kjopte').notNull().default(false),
  innkjopsprisOre: bigint('innkjopspris_ore', { mode: 'number' }),
  kjoptDato: date('kjopt_dato'),
  status: text().$type<'pa_bil' | 'pa_lager' | 'utslitt' | 'levert_tilbake'>().notNull().default('pa_lager'),
  lagerplass: text(),
  lagerId: uuid('lager_id').references(() => lagre.id),
  levetidSesonger: integer('levetid_sesonger').notNull().default(4),
  brukteSesonger: integer('brukte_sesonger').notNull().default(0),
  opprettet: na(),
}, (t) => [index('dekksett_abonnement_idx').on(t.abonnementId)]);

export const vinduer = pgTable('vinduer', {
  id: uuid().primaryKey(),
  ar: integer().notNull(),
  monterer: text().$type<'vinter' | 'sommer'>().notNull(),
  region: text().$type<'sor' | 'nord'>().notNull().default('sor'),
  start: date().notNull(),
  slutt: date().notNull(),
  lovpalagtFrist: date('lovpalagt_frist'),
}, (t) => [uniqueIndex('vinduer_unik').on(t.ar, t.monterer, t.region)]);

export const montorer = pgTable('montorer', {
  id: uuid().primaryKey(),
  kundeId: uuid('kunde_id').references(() => kunder.id),
  navn: text().notNull(),
  telefon: text().notNull(),
  aktiv: boolean().notNull().default(true),
});

export const jobber = pgTable('jobber', {
  id: uuid().primaryKey(),
  abonnementId: uuid('abonnement_id').notNull().references(() => abonnementer.id),
  vinduId: uuid('vindu_id').notNull().references(() => vinduer.id),
  stedId: uuid('sted_id').references(() => steder.id),
  adresse: jsonb().$type<Record<string, string>>(),
  monterer: text().$type<'vinter' | 'sommer'>().notNull(),
  status: text().$type<'planlagt' | 'tildelt' | 'utfort' | 'avlyst'>().notNull().default('planlagt'),
  planlagtDato: date('planlagt_dato'),
  montorId: uuid('montor_id').references(() => montorer.id),
  tilleggVask: boolean('tillegg_vask').notNull().default(false),
  henterSett: boolean('henter_sett').notNull().default(true),
  merknad: text(),
  kmStand: integer('km_stand'),
  momentNm: integer('moment_nm'),
  fullfort: timestamp({ withTimezone: true }),
  opprettet: na(),
}, (t) => [
  index('jobber_dato_idx').on(t.planlagtDato),
  index('jobber_abonnement_idx').on(t.abonnementId),
  index('jobber_montor_idx').on(t.montorId, t.planlagtDato),
]);

export const malinger = pgTable('malinger', {
  id: uuid().primaryKey(),
  dekksettId: uuid('dekksett_id').notNull().references(() => dekksett.id),
  jobbId: uuid('jobb_id').references(() => jobber.id),
  kmStand: integer('km_stand').notNull(),
  maltDato: timestamp('malt_dato', { withTimezone: true }).notNull().defaultNow(),
  hjul: jsonb().$type<HjulMaling[]>().notNull(),
  minMm: numeric('min_mm', { precision: 3, scale: 1 }).notNull(),
  maltAv: text('malt_av'),
  bildeUrler: jsonb('bilde_urler').$type<string[]>().notNull().default([]),
  opprettet: na(),
}, (t) => [index('malinger_dekksett_idx').on(t.dekksettId, t.maltDato)]);

export const skademeldinger = pgTable('skademeldinger', {
  id: uuid().primaryKey(),
  abonnementId: uuid('abonnement_id').notNull().references(() => abonnementer.id),
  type: text().$type<'punktering' | 'odelagt_dekk' | 'felg' | 'kollisjon' | 'annet'>().notNull(),
  posisjon: text().$type<Hjulposisjon>(),
  beskrivelse: text().notNull(),
  bildeUrler: jsonb('bilde_urler').$type<string[]>().notNull().default([]),
  status: text().$type<'mottatt' | 'planlagt' | 'utfort' | 'avvist'>().notNull().default('mottatt'),
  egenandelOre: bigint('egenandel_ore', { mode: 'number' }).notNull().default(0),
  dekkesAv: text('dekkes_av').$type<'skodd' | 'felg_pluss' | 'kunde' | 'bilforsikring'>().notNull().default('skodd'),
  frist: timestamp({ withTimezone: true }),
  opprettet: na(),
});

export const reservasjoner = pgTable('reservasjoner', {
  id: uuid().primaryKey(),
  telefon: text().notNull(),
  regnr: text(),
  epost: text(),
  postnummer: text(),
  kilde: text().notNull().default('landingsside'),
  kampanjekode: text(),
  abonnementId: uuid('abonnement_id').references(() => abonnementer.id),
  opprettet: na(),
}, (t) => [index('reservasjoner_telefon_idx').on(t.telefon)]);

export const kampanjekoder = pgTable('kampanjekoder', {
  kode: text().primaryKey(),
  eierKundeId: uuid('eier_kunde_id').references(() => kunder.id),
  gratisManeder: integer('gratis_maneder').notNull().default(1),
  kilde: text().$type<'nabo' | 'borettslag' | 'arbeidsplass' | 'annet'>().notNull().default('nabo'),
  bruktAntall: integer('brukt_antall').notNull().default(0),
  maksBruk: integer('maks_bruk'),
  aktiv: boolean().notNull().default(true),
  opprettet: na(),
});

export const engangskoder = pgTable('engangskoder', {
  telefon: text().primaryKey(),
  kodeHash: text('kode_hash').notNull(),
  utloper: timestamp({ withTimezone: true }).notNull(),
  forsok: integer().notNull().default(0),
});

export const npsSvar = pgTable('nps_svar', {
  id: uuid().primaryKey(),
  abonnementId: uuid('abonnement_id').notNull().references(() => abonnementer.id),
  jobbId: uuid('jobb_id').references(() => jobber.id),
  score: integer().notNull(),
  kommentar: text(),
  opprettet: na(),
});

export const hendelser = pgTable('hendelser', {
  id: uuid().primaryKey(),
  type: text().notNull(),
  abonnementId: uuid('abonnement_id').references(() => abonnementer.id),
  jobbId: uuid('jobb_id').references(() => jobber.id),
  data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  opprettet: na(),
}, (t) => [index('hendelser_type_idx').on(t.type, t.opprettet)]);

export const skjema = {
  kunder, steder, kjoretoy, abonnementer, lagre, dekksett, vinduer, montorer,
  jobber, malinger, skademeldinger, reservasjoner, kampanjekoder, engangskoder,
  npsSvar, hendelser,
};
