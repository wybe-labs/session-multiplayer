import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { enhetsokonomi, pilotbudsjett, kapasitet, stedstypeSchema, GATER } from '@skodd/core';
import { lagre, montorer, steder, vinduer } from '../db/schema.ts';
import { gateStatus, noktall, planleggSesong, sendPaminnelser, sikreVinduer, tildelDag } from '../tjenester/drift.ts';
import { nyId } from '../ids.ts';

/** Driftsflaten: planlegging, ruter og styringstall. Rollen ops. */
export const opsruter: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.skodd.krev(['ops']));

  app.get('/ops/noktall', async () => {
    const n = await noktall(app.skodd.db);
    return {
      noktall: n,
      gater: gateStatus(n).map((g) => ({
        id: g.gate.id, navn: g.gate.navn, dato: g.gate.dato, krav: g.gate.krav,
        hvisIkke: g.gate.hvisIkke, bestatt: g.bestatt, malinger: g.malinger,
      })),
      enhetsokonomi: {
        fullSlitasje: enhetsokonomi('skodd'),
        forsteAr: enhetsokonomi('skodd', undefined, { kundensEgneDekk: true }),
      },
      pilotbudsjett: pilotbudsjett(300),
    };
  });

  app.get('/ops/gater', async () => ({ gater: Object.values(GATER) }));

  app.post('/ops/vinduer', async (req) => {
    const { ar, region } = z.object({
      ar: z.number().int().min(2026).max(2040),
      region: z.enum(['sor', 'nord']).default('sor'),
    }).parse(req.body);
    await sikreVinduer(app.skodd.db, ar, region);
    return { vinduer: await app.skodd.db.select().from(vinduer).where(eq(vinduer.ar, ar)) };
  });

  app.post('/ops/vinduer/:id/planlegg', async (req) => {
    const { id } = req.params as { id: string };
    return planleggSesong(app.skodd.db, id);
  });

  /** Tildeler en dag til en montør og viser ruten med kostnad per skift. */
  app.post('/ops/dager', async (req) => {
    const input = z.object({
      vinduId: z.string().uuid(),
      dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      montorId: z.string().uuid(),
      maksJobber: z.number().int().min(1).max(40).default(20),
    }).parse(req.body);
    const { rute, bestarGate3 } = await tildelDag(
      app.skodd.db, input.vinduId, input.dato, input.montorId, input.maksJobber,
    );
    return {
      dato: input.dato,
      antallJobber: rute.antallJobber,
      totaltMinutter: rute.totaltMinutter,
      kostnadOre: rute.kostnadOre,
      kostnadPerSkiftOre: rute.kostnadPerSkiftOre,
      overKapasitet: rute.overKapasitet,
      bestarGate3,
      stopp: rute.stopp.map((s) => ({
        sted: s.sted.navn, type: s.sted.type, adresse: s.sted.adresse,
        antall: s.jobber.length, minutter: s.minutter,
        regnr: s.jobber.map((j) => j.regnr),
      })),
    };
  });

  app.post('/ops/paminnelser', async (req) => {
    const { dato } = z.object({ dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
    return { sendt: await sendPaminnelser(app.skodd.db, app.skodd.sms, dato) };
  });

  app.get('/ops/kapasitet', async (req) => {
    const { montorer: m, dager, snittPerSted } = z.object({
      montorer: z.coerce.number().int().min(1).default(2),
      dager: z.coerce.number().int().min(1).default(30),
      snittPerSted: z.coerce.number().int().min(1).default(8),
    }).parse(req.query);
    return kapasitet(m, dager, snittPerSted);
  });

  app.get('/ops/steder', async () => ({ steder: await app.skodd.db.select().from(steder) }));

  app.post('/ops/steder', async (req, svar) => {
    const input = z.object({
      navn: z.string().trim().min(2).max(120),
      type: stedstypeSchema,
      adresse: z.string().trim().min(4).max(200),
      postnummer: z.string().regex(/^\d{4}$/).optional(),
      antallBiler: z.number().int().min(0).max(5000).optional(),
      kontakt: z.string().trim().max(200).optional(),
      avtalestatus: z.enum(['prospekt', 'i_dialog', 'ja', 'nei']).default('prospekt'),
    }).parse(req.body);
    const id = nyId();
    await app.skodd.db.insert(steder).values({
      id, navn: input.navn, type: input.type, adresse: input.adresse,
      postnummer: input.postnummer ?? null, antallBiler: input.antallBiler ?? null,
      kontakt: input.kontakt ?? null, avtalestatus: input.avtalestatus,
    });
    return svar.code(201).send({ id });
  });

  app.patch('/ops/steder/:id', async (req) => {
    const { id } = req.params as { id: string };
    const input = z.object({
      avtalestatus: z.enum(['prospekt', 'i_dialog', 'ja', 'nei']).optional(),
      antallBiler: z.number().int().min(0).max(5000).optional(),
      kontakt: z.string().trim().max(200).optional(),
    }).parse(req.body);
    await app.skodd.db.update(steder).set(input).where(eq(steder.id, id));
    return { oppdatert: true };
  });

  app.post('/ops/lagre', async (req, svar) => {
    const input = z.object({
      navn: z.string().trim().min(2).max(120),
      adresse: z.string().trim().min(4).max(200),
      partner: z.string().trim().max(120).optional(),
      hyllemeter: z.number().int().min(0).default(0),
      kapasitetSett: z.number().int().min(0).default(0),
      prisPerSettArOre: z.number().int().min(0).optional(),
    }).parse(req.body);
    const id = nyId();
    await app.skodd.db.insert(lagre).values({
      id, navn: input.navn, adresse: input.adresse, partner: input.partner ?? null,
      hyllemeter: input.hyllemeter, kapasitetSett: input.kapasitetSett,
      prisPerSettArOre: input.prisPerSettArOre ?? null,
    });
    return svar.code(201).send({ id });
  });

  app.post('/ops/montorer', async (req, svar) => {
    const input = z.object({
      navn: z.string().trim().min(2).max(80),
      telefon: z.string().trim().min(8).max(20),
      kundeId: z.string().uuid().optional(),
    }).parse(req.body);
    const id = nyId();
    await app.skodd.db.insert(montorer).values({
      id, navn: input.navn, telefon: input.telefon, kundeId: input.kundeId ?? null,
    });
    return svar.code(201).send({ id });
  });

  app.get('/ops/montorer', async () => ({ montorer: await app.skodd.db.select().from(montorer) }));
};
