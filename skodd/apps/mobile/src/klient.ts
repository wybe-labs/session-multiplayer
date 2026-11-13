/** Det klienten og demomodusen deler: feiltypen og innloggingstokenet. */
export class ApiFeil extends Error {
  constructor(
    public readonly status: number,
    melding: string,
    public readonly detaljer?: { felt: string; melding: string }[],
  ) {
    super(melding);
    this.name = 'ApiFeil';
  }
}

let token: string | null = null;
export const settToken = (nytt: string | null): void => { token = nytt; };
export const hentGjeldendeToken = (): string | null => token;
