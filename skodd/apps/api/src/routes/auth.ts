import type { FastifyPluginAsync } from 'fastify';
import { sendKodeSchema, bekreftKodeSchema } from '@skodd/core';
import { bekreftKode, lagKode, lagreKode } from '../auth.ts';
import { MELDINGER } from '../adapters/sms.ts';
import { logg } from '../tjenester/hendelse.ts';

export const authRuter: FastifyPluginAsync = async (app) => {
  // Engangskoder er et åpenbart misbruksmål, så de er strengt rangert i drift.
  // Utenfor drift slås grensen av, og dekkes av en egen test mot produksjonsoppsettet.
  const idrift = app.skodd.env.NODE_ENV === 'production';
  const grense = (max: number) => ({ rateLimit: { max: idrift ? max : 10_000, timeWindow: '10 minutes' } });
  const fastKode = idrift ? undefined : app.skodd.env.UTVIKLING_FAST_KODE;

  app.post('/auth/kode', { config: grense(5) }, async (req) => {
    const { telefon } = sendKodeSchema.parse(req.body);
    const kode = fastKode ?? lagKode();
    await lagreKode(app.skodd.db, telefon, kode, app.skodd.env.KODE_PEPPER);
    await app.skodd.sms.send({ til: telefon, type: 'engangskode', tekst: MELDINGER.engangskode(kode) });
    // I utvikling skrives koden i serverloggen, så man kan logge inn uten SMS-avtale.
    // Den lekkes aldri i svaret, og aldri i drift.
    if (app.skodd.env.NODE_ENV === 'development') {
      app.log.info({ telefon, kode }, 'engangskode (kun utvikling)');
    }
    return { sendt: true };
  });

  app.post('/auth/bekreft', { config: grense(10) }, async (req, svar) => {
    const { telefon, kode } = bekreftKodeSchema.parse(req.body);
    const resultat = await bekreftKode(app.skodd.db, telefon, kode, app.skodd.env.KODE_PEPPER);
    if (!resultat.ok) return svar.code(401).send({ feil: resultat.grunn });
    if (resultat.nyKunde) await logg(app.skodd.db, 'kunde.opprettet', {});
    const token = app.jwt.sign(
      { kundeId: resultat.kundeId, telefon, rolle: resultat.rolle },
      { expiresIn: '30d' },
    );
    return { token, rolle: resultat.rolle, kundeId: resultat.kundeId };
  });
};
