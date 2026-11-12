/**
 * Temaet er merkevaren fra konseptet, hentet rett fra @skodd/core:
 * asfalt og snø som base, og en aksentfarge som skifter med sesongen.
 */
import { StyleSheet, type TextStyle } from 'react-native';
import { FARGER, FLATER, RADIUS, SPOR, aksentSesong } from '@skodd/core';

export const farge = {
  bakgrunn: FARGER.asfalt,
  flate: FLATER.asfaltMyk,
  kant: FLATER.asfaltKant,
  tekst: FARGER.sno,
  dempet: '#9A958C',
  grus: FARGER.grus,
  is: FARGER.is,
  sol: FARGER.sol,
  varsel: FLATER.varsel,
  ok: FLATER.ok,
} as const;

export const spor = SPOR;
export const radius = RADIUS;

/** Aksenten følger kalenderen: Is om vinteren, Sol om sommeren. */
export const aksentNa = (dato: Date = new Date()): string =>
  aksentSesong(dato) === 'is' ? farge.is : farge.sol;

export const skrift = {
  overskrift: 'SpaceGrotesk_700Bold',
  overskriftMedium: 'SpaceGrotesk_500Medium',
  brodtekst: 'Inter_400Regular',
  brodtekstMedium: 'Inter_500Medium',
  brodtekstHalvfet: 'Inter_600SemiBold',
} as const;

const h = (storrelse: number, hoyde: number): TextStyle => ({
  fontFamily: skrift.overskrift,
  fontSize: storrelse,
  lineHeight: hoyde,
  color: farge.tekst,
  letterSpacing: -0.4,
});

export const t = StyleSheet.create({
  h1: h(34, 38),
  h2: h(26, 30),
  h3: { ...h(19, 24), fontFamily: skrift.overskriftMedium, letterSpacing: -0.2 },
  tall: { ...h(48, 52), letterSpacing: -1.5 },
  brod: { fontFamily: skrift.brodtekst, fontSize: 16, lineHeight: 24, color: farge.tekst },
  brodDempet: { fontFamily: skrift.brodtekst, fontSize: 15, lineHeight: 22, color: farge.dempet },
  liten: { fontFamily: skrift.brodtekst, fontSize: 13, lineHeight: 18, color: farge.dempet },
  etikett: {
    fontFamily: skrift.brodtekstHalvfet,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: farge.dempet,
  },
  knapptekst: { fontFamily: skrift.brodtekstHalvfet, fontSize: 16, color: FARGER.asfalt },
});

export const formatterKr = (ore: number): string =>
  `${Math.round(ore / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`;

const MANEDER = ['jan', 'feb', 'mars', 'april', 'mai', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'des'];

export function datoTekst(iso: string | Date | null | undefined): string {
  if (!iso) return '–';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '–';
  return `${d.getUTCDate()}. ${MANEDER[d.getUTCMonth()]}`;
}

export const datoMedAr = (iso: string | Date | null | undefined): string => {
  if (!iso) return '–';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${datoTekst(d)} ${d.getUTCFullYear()}`;
};
