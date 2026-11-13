/**
 * Merkevaren som kode. Én kilde for app, API-kvitteringer og web.
 * Fra konseptdokumentet: én merkevare, to sesonger.
 */
export const FARGER = {
  asfalt: '#121314',
  sno: '#F3F1EC',
  is: '#8EC3E8',
  sol: '#F2B33D',
  grus: '#6B675F',
} as const;

/** Flater og tekst som ikke er merkevarefarger, men som holder paletten samlet. */
export const FLATER = {
  asfaltMyk: '#1C1E20',
  asfaltKant: '#2A2D30',
  snoKant: '#E2DED5',
  varsel: '#C8553D',
  ok: '#4F7A5B',
} as const;

export const TYPOGRAFI = {
  overskrift: 'SpaceGrotesk',
  brodtekst: 'Inter',
} as const;

export const LOFTE = 'Alltid skodd.';
export const UNDERTITTEL = 'Dekk som abonnement. Vi henter, lagrer, skifter og fornyer.';

export type Aksent = 'is' | 'sol';

/** Aksentfargen skifter med sesongen, slik dekkene gjør. */
export const aksentFarge = (aksent: Aksent): string => FARGER[aksent];

export const SPOR = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const RADIUS = { sm: 8, md: 14, lg: 20, pille: 999 } as const;
