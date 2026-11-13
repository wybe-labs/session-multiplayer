/** Utkastet under påmelding, delt mellom skjermene i onboardingen. */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Adresse, PakkeId, Stedstype, TilleggId } from '@skodd/core';
import type { TilbudSvar } from './api.ts';

export interface Utkast {
  regnr: string;
  tilbud: TilbudSvar | null;
  pakke: PakkeId | null;
  tillegg: TilleggId[];
  kmPerAr: number;
  stedstype: Stedstype | null;
  stedId?: string;
  adresse?: Adresse;
  egneDekk: 'begge_sett' | 'ett_sett' | 'ingen';
  kampanjekode?: string;
}

const tomt: Utkast = {
  regnr: '', tilbud: null, pakke: null, tillegg: [], kmPerAr: 15_000,
  stedstype: null, egneDekk: 'begge_sett',
};

interface Verdi {
  utkast: Utkast;
  sett(delvis: Partial<Utkast>): void;
  nullstill(): void;
}

const Ctx = createContext<Verdi | null>(null);

export function PameldingTilbyder({ children }: { children: ReactNode }) {
  const [utkast, settUtkast] = useState<Utkast>(tomt);
  const verdi = useMemo<Verdi>(() => ({
    utkast,
    sett: (delvis) => settUtkast((f) => ({ ...f, ...delvis })),
    nullstill: () => settUtkast(tomt),
  }), [utkast]);
  return <Ctx.Provider value={verdi}>{children}</Ctx.Provider>;
}

export function usePamelding(): Verdi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePamelding må brukes inne i PameldingTilbyder');
  return v;
}
