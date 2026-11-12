import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  opprettAbonnementSchema, bookSkiftSchema, skademeldingSchema, tilleggIdSchema,
  nesteVindu, type TilleggId,
} from '@skodd/core';
import { z } from 'zod';
import { abonnementer, dekksett, jobber, kjoretoy, kunder, malinger, npsSvar, vinduer } from '../db/schema.ts';
import { beregnOppsigelse, endreTillegg, hentOversikt, meldPa, sigOpp } from '../tjenester/abonnement.ts';
import { meldSkade } from '../tjenester/drift.ts';
import { nyId } from '../ids.ts';

const profilSchema = z.object({
  navn: z.string().trim().min(2).max(80).optional(),
  epost: z.string().trim().email().optional(),
});

/** Alt appen gjør for en innlogget kunde. */
export const kunderuter: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.skodd.krev(['kunde', 'montor', 'ops']));

  app.get('/meg', async (req) => {
    const { kundeId } = req.bruker;
    const [kunde] = await app.skodd.db.select().from(kunder).where(eq(kunder.id, kundeId));
    const abos = await app.skodd.db
      .select({ abo: abonnementer, regnr: kjoretoy.regnr, merke: kjoretoy.merke, modell: kjoretoy.modell })
      .from(abonnementer)
      .innerJoin(kjoretoy, eq(abonnementer.kjoretoyId, kjoretoy.id))
      .where(eq(abonnementer.kundeId, kundeId))
      .orderBy(desc(abonnementer.opprettet));

    return {
      kunde: kunde ? { id: kunde.id, telefon: kunde.telefon, navn: kunde.navn, epost: kunde.epost, rolle: kunde.rolle } : null,
      abonnementer: abos.map((a) => ({
        id: a.abo.id, status: a.abo.status, pakke: a.abo.pakke, manedsprisOre: a.abo.manedsprisOre,
        regnr: a.regnr, bil: `${a.merke} ${a.modell}`,
      })),
    };
  });

  app.patch('/meg', async (req) => {
    const input = profilSchema.parse(req.body);
    await app.skodd.db.update(kunder)
      .set({ ...(input.navn ? { navn: input.navn } : {}), ...(input.epost ? { epost: input.epost } : {}) })
      .where(eq(kunder.id, req.bruker.kundeId));
    return { oppdatert: true };
  });

  app.post('/abonnementer', async (req, svar) => {
    const input = opprettAbonnementSchema.parse(req.body);
    const resultat = await meldPa(app.skodd, req.bruker.kundeId, input);
    return svar.code(201).send(resultat);
  });

  app.get('/abonnementer/:id', async (req, svar) => {
    const { id } = req.params as { id: string };
    if (!(await app.skodd.eierAbonnement(req.bruker, id))) return svar.code(404).send({ feil: 'Ukjent abonnement' });
    const oversikt = await hentOversikt(app.skodd.db, id);
    if (!oversikt) return svar.code(404).send({ feil: 'Ukjent abonnement' });
    return oversikt;
  });

  app.put('/abonnementer/:id/tillegg', async (req, svar) => {
    const { id } = req.params as { id: string };
    if (!(await app.skodd.eierAbonnement(req.bruker, id))) return svar.code(404).send({ feil: 'Ukjent abonnement' });
    const { tillegg } = z.object({ tillegg: z.array(tilleggIdSchema) }).parse(req.body);
    return endreTillegg(app.skodd, id, tillegg as TilleggId[]);
  });

  app.get('/abonnementer/:id/oppsigelse', async (req, svar) => {
    const { id } = req.params as { id: string };
    if (!(await app.skodd.eierAbonnement(req.bruker, id))) return svar.code(404).send({ feil: 'Ukjent abonnement' });
    return beregnOppsigelse(app.skodd.db, id);
  });

  app.post('/abonnementer/:id/oppsigelse', async (req, svar) => {
    const { id } = req.params as { id: string };
    if (!(await app.skodd.eierAbonnement(req.bruker, id))) return svar.code(404).send({ feil: 'Ukjent abonnement' });
    const { bekreftet } = z.object({ bekreftet: z.literal(true) }).parse(req.body);
    void bekreftet;
    return sigOpp(app.skodd, id);
  });

  /** Målehistorikken: mønster per hjul, per skift. Grunnlaget for Dekkene-fanen. */
  app.get('/abonnementer/:id/malinger', async (req, svar) => {
    const { id } = req.params as { id: string };
    if (!(await app.skodd.eierAbonnement(req.bruker, id))) return svar.code(404).send({ feil: 'Ukjent abonnement' });

    const rader = await app.skodd.db
      .select({
        id: malinger.id, dekksettId: malinger.dekksettId, kmStand: malinger.kmStand,
        maltDato: malinger.maltDato, hjul: malinger.hjul, minMm: malinger.minMm,
        sesong: dekksett.sesong, settStatus: dekksett.status,
      })
      .from(malinger)
      .innerJoin(dekksett, eq(malinger.dekksettId, dekksett.id))
      .where(eq(dekksett.abonnementId, id))
      .orderBy(desc(malinger.maltDato));

    return { malinger: rader.map((r) => ({ ...r, minMm: Number(r.minMm) })) };
  });

  /** Vinduene kunden kan velge mellom. */
  app.get('/vinduer', async () => {
    const rader = await app.skodd.db.select().from(vinduer).orderBy(vinduer.start);
    const neste = nesteVindu(new Date());
    return {
      vinduer: rader,
      anbefalt: { monterer: neste.monterer, start: neste.start.toISOString().slice(0, 10) },
    };
  });

  /** Booker eller flytter skiftet i et vindu. */
  app.post('/jobber', async (req, svar) => {
    const input = bookSkiftSchema.parse(req.body);
    if (!(await app.skodd.eierAbonnement(req.bruker, input.abonnementId))) {
      return svar.code(404).send({ feil: 'Ukjent abonnement' });
    }
    const [vindu] = await app.skodd.db.select().from(vinduer).where(eq(vinduer.id, input.vinduId));
    if (!vindu) return svar.code(404).send({ feil: 'Ukjent vindu' });

    const [fra_for] = await app.skodd.db.select().from(jobber).where(and(
      eq(jobber.abonnementId, input.abonnementId),
      eq(jobber.vinduId, input.vinduId),
      inArray(jobber.status, ['planlagt', 'tildelt']),
    ));

    const felt = {
      stedId: input.stedId ?? null,
      adresse: input.adresse ?? null,
      tilleggVask: input.tilleggVask,
      merknad: input.merknad ?? null,
    };

    if (fra_for) {
      await app.skodd.db.update(jobber).set(felt).where(eq(jobber.id, fra_for.id));
      return { id: fra_for.id, status: fra_for.status, flyttet: true };
    }

    const id = nyId();
    await app.skodd.db.insert(jobber).values({
      id, abonnementId: input.abonnementId, vinduId: input.vinduId,
      monterer: vindu.monterer, status: 'planlagt', ...felt,
    });
    return svar.code(201).send({ id, status: 'planlagt', flyttet: false });
  });

  app.get('/jobber', async (req) => {
    const abos = await app.skodd.db.select({ id: abonnementer.id }).from(abonnementer)
      .where(eq(abonnementer.kundeId, req.bruker.kundeId));
    if (!abos.length) return { jobber: [] };
    const rader = await app.skodd.db.select().from(jobber)
      .where(inArray(jobber.abonnementId, abos.map((a) => a.id)))
      .orderBy(desc(jobber.opprettet));
    return { jobber: rader };
  });

  app.post('/skade', async (req, svar) => {
    const input = skademeldingSchema.parse(req.body);
    if (!(await app.skodd.eierAbonnement(req.bruker, input.abonnementId))) {
      return svar.code(404).send({ feil: 'Ukjent abonnement' });
    }
    const resultat = await meldSkade(app.skodd.db, app.skodd.sms, {
      abonnementId: input.abonnementId,
      type: input.type,
      ...(input.posisjon ? { posisjon: input.posisjon } : {}),
      beskrivelse: input.beskrivelse,
      bildeUrler: input.bildeUrler,
    });
    return svar.code(201).send(resultat);
  });

  app.post('/nps', async (req, svar) => {
    const input = z.object({
      abonnementId: z.string().uuid(),
      jobbId: z.string().uuid().optional(),
      score: z.number().int().min(0).max(10),
      kommentar: z.string().trim().max(500).optional(),
    }).parse(req.body);
    if (!(await app.skodd.eierAbonnement(req.bruker, input.abonnementId))) {
      return svar.code(404).send({ feil: 'Ukjent abonnement' });
    }
    const id = nyId();
    await app.skodd.db.insert(npsSvar).values({
      id, abonnementId: input.abonnementId, jobbId: input.jobbId ?? null,
      score: input.score, kommentar: input.kommentar ?? null,
    });
    return svar.code(201).send({ id });
  });

  /** Presignert lenke, så bilder går rett fra mobilen til lageret. */
  app.post('/bilder/lenke', async (req) => {
    const { mappe, filtype } = z.object({
      mappe: z.enum(['skade', 'monster', 'bil']),
      filtype: z.enum(['jpg', 'jpeg', 'png', 'heic']),
    }).parse(req.body);
    return app.skodd.bilder.lagOpplastingslenke(`${mappe}/${req.bruker.kundeId}`, filtype);
  });
};
