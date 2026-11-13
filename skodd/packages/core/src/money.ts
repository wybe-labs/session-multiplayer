/** Alle beløp i hele øre, som heltall. Aldri flyttall på penger. */
export type Ore = number;

export const MVA_SATS = 0.25;

export const kr = (kroner: number): Ore => Math.round(kroner * 100);
export const tilKroner = (ore: Ore): number => ore / 100;

/** Trekker ut mva fra et bruttobeløp (pris inkl. mva). */
export const eksMva = (brutto: Ore): Ore => Math.round(brutto / (1 + MVA_SATS));

/** Legger mva på et nettobeløp. */
export const inklMva = (netto: Ore): Ore => Math.round(netto * (1 + MVA_SATS));

export const mvaAv = (brutto: Ore): Ore => brutto - eksMva(brutto);

/** Norsk formatering: 4 788 kr. Brukes i app og SMS. */
export function formatKr(ore: Ore, opts: { desimaler?: boolean } = {}): string {
  const verdi = tilKroner(ore);
  const tekst = opts.desimaler
    ? verdi.toFixed(2).replace('.', ',')
    : String(Math.round(verdi));
  return `${tekst.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`;
}

export const prosentAv = (ore: Ore, prosent: number): Ore => Math.round(ore * prosent);
