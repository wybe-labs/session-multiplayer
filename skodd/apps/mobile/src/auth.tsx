/** Innlogging holdes i én kontekst. Token hentes fra nøkkelringen ved oppstart. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, settToken } from './api.ts';
import { hentToken, lagreToken, slettToken } from './lagring.ts';

export type Rolle = 'kunde' | 'montor' | 'ops';

export interface Bruker {
  kundeId: string;
  rolle: Rolle;
  navn: string | null;
  telefon: string;
}

interface AuthVerdi {
  klar: boolean;
  bruker: Bruker | null;
  loggInn(telefon: string, kode: string): Promise<Rolle>;
  loggUt(): Promise<void>;
  oppdater(): Promise<void>;
}

const Auth = createContext<AuthVerdi | null>(null);

export function AuthTilbyder({ children }: { children: ReactNode }) {
  const [klar, settKlar] = useState(false);
  const [bruker, settBruker] = useState<Bruker | null>(null);

  const hentMeg = useCallback(async () => {
    try {
      const { kunde } = await api.meg();
      if (kunde) {
        settBruker({ kundeId: kunde.id, rolle: kunde.rolle, navn: kunde.navn, telefon: kunde.telefon });
        return;
      }
      settBruker(null);
    } catch {
      settToken(null);
      await slettToken();
      settBruker(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await hentToken();
      if (token) {
        settToken(token);
        await hentMeg();
      }
      settKlar(true);
    })();
  }, [hentMeg]);

  const verdi = useMemo<AuthVerdi>(() => ({
    klar,
    bruker,
    async loggInn(telefon, kode) {
      const svar = await api.bekreftKode(telefon, kode);
      settToken(svar.token);
      await lagreToken(svar.token);
      await hentMeg();
      return svar.rolle;
    },
    async loggUt() {
      settToken(null);
      await slettToken();
      settBruker(null);
    },
    oppdater: hentMeg,
  }), [klar, bruker, hentMeg]);

  return <Auth.Provider value={verdi}>{children}</Auth.Provider>;
}

export function useAuth(): AuthVerdi {
  const verdi = useContext(Auth);
  if (!verdi) throw new Error('useAuth må brukes inne i AuthTilbyder');
  return verdi;
}
