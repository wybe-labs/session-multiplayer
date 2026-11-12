import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { Env } from './env.ts';
import type { Db, Tilkobling } from './db/client.ts';
import { abonnementer } from './db/schema.ts';
import type { Rolle, Token } from './auth.ts';
import {
  FalskKjoretoyregister, MockBetaling, MockBildelager, MockSms, HttpSms, S3Bildelager,
  StripeBetaling, SvvKjoretoyregister,
  type Betaling, type Bildelager, type Kjoretoyregister, type Sms,
} from './adapters/index.ts';
import { offentligeRuter } from './routes/offentlig.ts';
import { authRuter } from './routes/auth.ts';
import { kunderuter } from './routes/kunde.ts';
import { montorruter } from './routes/montor.ts';
import { opsruter } from './routes/ops.ts';
import { webhookruter } from './routes/webhooks.ts';

export interface Skodd {
  env: Env;
  db: Db;
  register: Kjoretoyregister;
  betaling: Betaling;
  sms: Sms;
  bilder: Bildelager;
  krev(roller: Rolle[]): (req: any, svar: any) => Promise<void>;
  eierAbonnement(bruker: Token, abonnementId: string): Promise<boolean>;
}

declare module 'fastify' {
  interface FastifyInstance {
    skodd: Skodd;
  }
  interface FastifyRequest {
    bruker: Token;
    rawKropp?: string;
  }
}

export interface Valg {
  env: Env;
  tilkobling: Tilkobling;
  /** Overstyres i test. */
  register?: Kjoretoyregister;
  betaling?: Betaling;
  sms?: Sms;
  bilder?: Bildelager;
  logg?: boolean;
}

export async function byggApp(valg: Valg): Promise<FastifyInstance> {
  const { env, tilkobling } = valg;
  const app = Fastify({
    logger: valg.logg ?? env.NODE_ENV !== 'test',
    bodyLimit: 1_048_576,
    trustProxy: true,
  });

  // Rå kropp beholdes, slik at webhook-signaturer kan verifiseres.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, kropp, ferdig) => {
    req.rawKropp = kropp as string;
    if (!kropp) return ferdig(null, {});
    try {
      ferdig(null, JSON.parse(kropp as string));
    } catch (e) {
      ferdig(e as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_HEMMELIGHET });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  const register = valg.register
    ?? (env.SVV_API_NOKKEL ? new SvvKjoretoyregister(env.SVV_API_NOKKEL) : new FalskKjoretoyregister());
  const betaling = valg.betaling
    ?? (env.STRIPE_SECRET_KEY
      ? new StripeBetaling(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET ?? '')
      : new MockBetaling());
  const sms = valg.sms
    ?? (env.SMS_URL && env.SMS_NOKKEL ? new HttpSms(env.SMS_URL, env.SMS_NOKKEL) : new MockSms());
  const bilder = valg.bilder ?? new MockBildelager();

  const krev = (roller: Rolle[]) => async (req: any, svar: any): Promise<void> => {
    try {
      await req.jwtVerify();
    } catch {
      return svar.code(401).send({ feil: 'Ikke innlogget' });
    }
    const bruker = req.user as Token;
    if (!roller.includes(bruker.rolle)) {
      return svar.code(403).send({ feil: 'Mangler tilgang' });
    }
    req.bruker = bruker;
  };

  const eierAbonnement = async (bruker: Token, abonnementId: string): Promise<boolean> => {
    if (bruker.rolle === 'ops') return true;
    const [treff] = await tilkobling.db.select({ id: abonnementer.id }).from(abonnementer)
      .where(and(eq(abonnementer.id, abonnementId), eq(abonnementer.kundeId, bruker.kundeId)));
    return !!treff;
  };

  app.decorate('skodd', {
    env, db: tilkobling.db, register, betaling, sms, bilder, krev, eierAbonnement,
  } satisfies Skodd);

  app.setErrorHandler((feil: unknown, _req, svar) => {
    if (feil instanceof ZodError) {
      return svar.code(400).send({
        feil: 'Ugyldige felt',
        detaljer: feil.issues.map((i) => ({ felt: i.path.join('.'), melding: i.message })),
      });
    }
    const status = (feil as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error({ feil }, 'Uventet feil');
    const melding = feil instanceof Error ? feil.message : 'Ukjent feil';
    return svar.code(status).send({ feil: status >= 500 ? 'Noe gikk galt hos oss' : melding });
  });

  await app.register(offentligeRuter, { prefix: '/v1' });
  await app.register(authRuter, { prefix: '/v1' });
  await app.register(kunderuter, { prefix: '/v1' });
  await app.register(montorruter, { prefix: '/v1' });
  await app.register(webhookruter, { prefix: '/v1' });
  if (env.OPS_AKTIVERT) await app.register(opsruter, { prefix: '/v1' });

  return app;
}

export { MockBetaling, MockSms, MockBildelager, FalskKjoretoyregister, S3Bildelager };
