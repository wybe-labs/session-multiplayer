import { z } from 'zod';

const skjema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  HOST: z.string().default('0.0.0.0'),
  /** «memory» for PGlite i minnet, «pglite:./data» for fil, ellers postgres-URL. */
  DATABASE_URL: z.string().default('memory'),
  JWT_HEMMELIGHET: z.string().min(16).default('bare-til-utvikling-bytt-denne-i-drift'),
  /** Pepper på engangskodene. */
  KODE_PEPPER: z.string().default('skodd-pepper-utvikling'),
  /**
   * Fast engangskode til demo og lokal utvikling. Ignoreres alltid i drift,
   * uansett om den er satt.
   */
  UTVIKLING_FAST_KODE: z.string().regex(/^\d{6}$/).optional(),
  SVV_API_NOKKEL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SMS_URL: z.string().optional(),
  SMS_NOKKEL: z.string().optional(),
  BILDER_BASE: z.string().optional(),
  /** Slår på /v1/ops. Av som standard. */
  OPS_AKTIVERT: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof skjema>;
export const lesEnv = (kilde: NodeJS.ProcessEnv = process.env): Env => skjema.parse(kilde);
