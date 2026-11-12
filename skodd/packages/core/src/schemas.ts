/** API-kontrakten. Samme skjema validerer server inn og klient ut. */
import { z } from 'zod';

export const regnrSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
  .refine((s) => /^[A-HJ-NPR-TV-Z]{2}\d{5}$/.test(s), 'Ugyldig registreringsnummer');

export const telefonSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .transform((s) => (s.startsWith('+') ? s : s.startsWith('00') ? `+${s.slice(2)}` : `+47${s}`))
  .refine((s) => /^\+47[49]\d{7}$/.test(s), 'Oppgi et norsk mobilnummer');

export const pakkeIdSchema = z.enum(['skodd', 'skodd_stor', 'skodd_premium']);
export const tilleggIdSchema = z.enum(['felg_pluss', 'vask_ved_skift', 'over_15000_km']);
export const sesongSchema = z.enum(['vinter', 'sommer']);
export const stedstypeSchema = z.enum(['borettslag', 'arbeidsplass', 'hjemme', 'garasjeanlegg']);
export const hjulSchema = z.enum(['VF', 'HF', 'VB', 'HB']);

export const dimensjonSchema = z.object({
  bredde: z.number().int().min(125).max(355),
  profil: z.number().int().min(25).max(85),
  tommer: z.number().int().min(13).max(24),
  lastindeks: z.number().int().optional(),
  hastighetsindeks: z.string().max(2).optional(),
});

export const tilbudForesporselSchema = z.object({
  regnr: regnrSchema,
  kmPerAr: z.number().int().min(0).max(100_000).optional(),
  tillegg: z.array(tilleggIdSchema).optional(),
  flerbil: z.boolean().optional(),
  kampanjekode: z.string().trim().max(32).optional(),
});

export const sendKodeSchema = z.object({ telefon: telefonSchema });
export const bekreftKodeSchema = z.object({
  telefon: telefonSchema,
  kode: z.string().trim().regex(/^\d{6}$/, 'Koden har seks siffer'),
});

export const adresseSchema = z.object({
  gate: z.string().trim().min(2).max(120),
  postnummer: z.string().trim().regex(/^\d{4}$/),
  poststed: z.string().trim().min(2).max(60),
  merknad: z.string().trim().max(280).optional(),
});

export const opprettAbonnementSchema = z.object({
  regnr: regnrSchema,
  pakke: pakkeIdSchema,
  tillegg: z.array(tilleggIdSchema).default([]),
  kmPerAr: z.number().int().min(0).max(100_000).default(15_000),
  stedstype: stedstypeSchema,
  stedId: z.string().uuid().optional(),
  adresse: adresseSchema.optional(),
  kampanjekode: z.string().trim().max(32).optional(),
  /** Kunden må bekrefte binding og angrerett før vi tar depositum. */
  godtarVilkar: z.literal(true),
  /** Har kunden egne dekk vi kan ta inn som lager. */
  egneDekk: z.enum(['begge_sett', 'ett_sett', 'ingen']).default('begge_sett'),
});

export const bookSkiftSchema = z.object({
  abonnementId: z.string().uuid(),
  vinduId: z.string().uuid(),
  stedId: z.string().uuid().optional(),
  adresse: adresseSchema.optional(),
  tilleggVask: z.boolean().default(false),
  merknad: z.string().trim().max(280).optional(),
});

export const hjulMalingSchema = z.object({
  posisjon: hjulSchema,
  innerMm: z.number().min(0).max(12),
  midtMm: z.number().min(0).max(12),
  ytterMm: z.number().min(0).max(12),
});

export const fullforJobbSchema = z.object({
  kmStand: z.number().int().min(0).max(2_000_000),
  monterteSesong: sesongSchema,
  /** Mønster på settet vi satte på. Det er dette kunden kjører på nå. */
  hjul: z.array(hjulMalingSchema).length(4),
  /** Mønster på settet vi tok av, hvis montøren fikk målt det også. */
  hjulAvmontert: z.array(hjulMalingSchema).length(4).optional(),
  /** Tiltrekkingsmoment i Nm, dokumentert mot skaderisiko. */
  momentNm: z.number().int().min(60).max(200).optional(),
  bildeUrler: z.array(z.string().url()).max(12).default([]),
  merknad: z.string().trim().max(500).optional(),
  /** Settet vi tok med tilbake til lageret. */
  henterSett: z.boolean().default(true),
});

export const skademeldingSchema = z.object({
  abonnementId: z.string().uuid(),
  type: z.enum(['punktering', 'odelagt_dekk', 'felg', 'kollisjon', 'annet']),
  posisjon: hjulSchema.optional(),
  beskrivelse: z.string().trim().min(5).max(1000),
  bildeUrler: z.array(z.string().url()).max(8).default([]),
});

export const reservasjonSchema = z.object({
  telefon: telefonSchema,
  regnr: regnrSchema.optional(),
  epost: z.string().trim().email().optional(),
  postnummer: z.string().trim().regex(/^\d{4}$/).optional(),
  kilde: z.enum(['landingsside', 'borettslag', 'arbeidsplass', 'nabokode', 'annet']).default('landingsside'),
  kampanjekode: z.string().trim().max(32).optional(),
});

export type TilbudForesporsel = z.infer<typeof tilbudForesporselSchema>;
export type OpprettAbonnement = z.infer<typeof opprettAbonnementSchema>;
export type BookSkift = z.infer<typeof bookSkiftSchema>;
export type FullforJobb = z.infer<typeof fullforJobbSchema>;
export type Skademelding = z.infer<typeof skademeldingSchema>;
export type Reservasjon = z.infer<typeof reservasjonSchema>;
export type Adresse = z.infer<typeof adresseSchema>;
