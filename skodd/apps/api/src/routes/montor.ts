import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { fullforJobbSchema } from '@skodd/core';
import { z } from 'zod';
import { montorer } from '../db/schema.ts';
import { fullforJobb, hentJobber } from '../tjenester/drift.ts';

/** Montørappen. Samme app, egen modus, låst til rollen montor. */
export const montorruter: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.skodd.krev(['montor', 'ops']));

  const minMontorId = async (kundeId: string): Promise<string | null> => {
    const [m] = await app.skodd.db.select().from(montorer).where(eq(montorer.kundeId, kundeId));
    return m?.id ?? null;
  };

  app.get('/montor/jobber', async (req, svar) => {
    const { dato } = z.object({ dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
    const montorId = await minMontorId(req.bruker.kundeId);
    if (!montorId) return svar.code(403).send({ feil: 'Du er ikke registrert som montør' });

    const liste = await hentJobber(app.skodd.db, { dato, montorId });
    return {
      dato,
      jobber: liste.map((j) => ({
        id: j.jobb.id,
        regnr: j.regnr,
        monterer: j.jobb.monterer,
        status: j.jobb.status,
        sted: j.sted ? { navn: j.sted.navn, adresse: j.sted.adresse, type: j.sted.type } : null,
        adresse: j.jobb.adresse,
        tilleggVask: j.jobb.tilleggVask,
        henterSett: j.jobb.henterSett,
        kunde: { navn: j.kundeNavn, telefon: j.kundeTelefon },
        merknad: j.jobb.merknad,
      })),
    };
  });

  app.post('/montor/jobber/:id/fullfor', async (req, svar) => {
    const { id } = req.params as { id: string };
    const input = fullforJobbSchema.parse(req.body);
    const montorId = await minMontorId(req.bruker.kundeId);
    const resultat = await fullforJobb(
      app.skodd.db, app.skodd.sms, id, input, montorId ?? req.bruker.telefon,
    );
    return svar.code(200).send(resultat);
  });

  app.post('/montor/bilder/lenke', async (req) => {
    const { filtype } = z.object({ filtype: z.enum(['jpg', 'jpeg', 'png', 'heic']) }).parse(req.body);
    return app.skodd.bilder.lagOpplastingslenke(`monster/${req.bruker.kundeId}`, filtype);
  });
};
