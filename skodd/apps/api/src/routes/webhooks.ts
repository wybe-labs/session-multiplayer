import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { abonnementer } from '../db/schema.ts';
import { bekreftDepositum } from '../tjenester/abonnement.ts';
import { logg } from '../tjenester/hendelse.ts';

/**
 * Webhook fra betalingsleverandøren. Rå kropp, signatur verifisert av
 * adapteren, ingen innlogging.
 */
export const webhookruter: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/betaling', async (req, svar) => {
    const kropp = req.rawKropp ?? JSON.stringify(req.body ?? {});
    const hendelse = app.skodd.betaling.verifiserWebhook(kropp, req.headers['stripe-signature'] as string | undefined);
    if (!hendelse) return svar.code(400).send({ feil: 'Ugyldig signatur' });

    let abonnementId = hendelse.abonnementId;
    if (!abonnementId) {
      const [treff] = await app.skodd.db.select({ id: abonnementer.id }).from(abonnementer)
        .where(eq(abonnementer.betalingRef, hendelse.ref));
      abonnementId = treff?.id;
    }
    if (!abonnementId) return svar.code(202).send({ ignorert: true });

    if (hendelse.type === 'depositum.betalt') {
      await bekreftDepositum(app.skodd, abonnementId);
    } else if (hendelse.type === 'abonnement.feilet') {
      await app.skodd.db.update(abonnementer).set({ status: 'venter_betaling' })
        .where(eq(abonnementer.id, abonnementId));
      await logg(app.skodd.db, 'betaling.feilet', { abonnementId, data: { ref: hendelse.ref } });
    } else {
      await logg(app.skodd.db, `betaling.${hendelse.type}`, { abonnementId, data: { ref: hendelse.ref } });
    }
    return { mottatt: true };
  });
};
