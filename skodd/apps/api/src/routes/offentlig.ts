import type { FastifyPluginAsync } from 'fastify';
import { tilbudForesporselSchema, reservasjonSchema, PAKKER, TILLEGG, VILKAR, FARGER, LOFTE, UNDERTITTEL } from '@skodd/core';
import { lagTilbudFor } from '../tjenester/tilbud.ts';
import { reservasjoner } from '../db/schema.ts';
import { nyId } from '../ids.ts';
import { logg } from '../tjenester/hendelse.ts';

/** Alt som ikke krever innlogging: pris, forhåndsbestilling og pakkeliste. */
export const offentligeRuter: FastifyPluginAsync = async (app) => {
  app.get('/helse', async () => ({ ok: true, tid: new Date().toISOString() }));

  app.get('/pakker', async () => ({
    pakker: Object.values(PAKKER),
    tillegg: Object.values(TILLEGG),
    vilkar: VILKAR,
    merkevare: { lofte: LOFTE, undertittel: UNDERTITTEL, farger: FARGER },
  }));

  app.post('/tilbud', async (req, svar) => {
    const input = tilbudForesporselSchema.parse(req.body);
    const resultat = await lagTilbudFor(app.skodd.register, app.skodd.db, input);
    if (!resultat) return svar.code(404).send({ feil: 'Fant ikke bilen' });
    await logg(app.skodd.db, 'tilbud.vist', { data: { regnr: input.regnr, pakke: resultat.tilbud.pakke.id } });
    return resultat;
  });

  /** Forhåndsbestilling fra landingssiden. Gate 1 teller disse. */
  app.post('/reservasjoner', async (req, svar) => {
    const input = reservasjonSchema.parse(req.body);
    const id = nyId();
    await app.skodd.db.insert(reservasjoner).values({
      id,
      telefon: input.telefon,
      regnr: input.regnr ?? null,
      epost: input.epost ?? null,
      postnummer: input.postnummer ?? null,
      kilde: input.kilde,
      kampanjekode: input.kampanjekode ?? null,
    });
    await logg(app.skodd.db, 'reservasjon.opprettet', { data: { kilde: input.kilde } });
    return svar.code(201).send({ id, melding: 'Takk. Vi tar kontakt før vårsesongen.' });
  });
};
