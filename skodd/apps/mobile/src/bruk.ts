/** Små hooks for datahenting. Ingen cache-bibliotek: appen har få skjermer. */
import { useCallback, useEffect, useState } from 'react';
import { api, ApiFeil, type Oversikt } from './api.ts';

export interface Hentet<T> {
  data: T | null;
  laster: boolean;
  feil: string | null;
  last(): Promise<void>;
}

export function useHentet<T>(hent: () => Promise<T>, avhengigheter: unknown[] = []): Hentet<T> {
  const [data, settData] = useState<T | null>(null);
  const [laster, settLaster] = useState(true);
  const [feil, settFeil] = useState<string | null>(null);

  const last = useCallback(async () => {
    settLaster(true);
    settFeil(null);
    try {
      settData(await hent());
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke kontakt.');
    } finally {
      settLaster(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, avhengigheter);

  useEffect(() => { void last(); }, [last]);
  return { data, laster, feil, last };
}

/** Det aktive abonnementet med full oversikt. Appen viser én bil av gangen. */
export function useMittAbonnement(): Hentet<Oversikt> & { ingenAbonnement: boolean } {
  const [ingen, settIngen] = useState(false);
  const hentet = useHentet<Oversikt>(async () => {
    const { abonnementer } = await api.meg();
    const aktivt = abonnementer.find((a) => a.status === 'aktiv')
      ?? abonnementer.find((a) => a.status === 'venter_betaling')
      ?? abonnementer[0];
    if (!aktivt) {
      settIngen(true);
      throw new ApiFeil(404, 'Du har ikke noe abonnement ennå');
    }
    settIngen(false);
    return api.oversikt(aktivt.id);
  }, []);
  return { ...hentet, ingenAbonnement: ingen };
}
