/**
 * Bildelagring. Montøren fotograferer mønster og bil før og etter, både som
 * dokumentasjon mot skadekrav og som grunnlag for AI-måling av mønster senere.
 */
import { randomUUID } from 'node:crypto';

export interface Opplastingslenke {
  /** URL klienten laster bildet opp til. */
  opplastUrl: string;
  /** URL bildet kan leses fra etterpå. */
  lesUrl: string;
  felt?: Record<string, string>;
}

export interface Bildelager {
  lagOpplastingslenke(mappe: string, filtype: string): Promise<Opplastingslenke>;
}

export class MockBildelager implements Bildelager {
  readonly lenker: Opplastingslenke[] = [];
  async lagOpplastingslenke(mappe: string, filtype: string): Promise<Opplastingslenke> {
    const navn = `${mappe}/${randomUUID()}.${filtype}`;
    const lenke = {
      opplastUrl: `https://bilder.test/opplast/${navn}`,
      lesUrl: `https://bilder.test/${navn}`,
    };
    this.lenker.push(lenke);
    return lenke;
  }
}

/**
 * S3-kompatibelt lager (AWS, Cloudflare R2, Hetzner). Presignert PUT, slik at
 * bildene går rett fra mobilen og aldri gjennom API-et.
 */
export class S3Bildelager implements Bildelager {
  constructor(
    private readonly signer: (nokkel: string, metode: 'PUT') => Promise<string>,
    private readonly offentligBase: string,
  ) {}

  async lagOpplastingslenke(mappe: string, filtype: string): Promise<Opplastingslenke> {
    const nokkel = `${mappe}/${randomUUID()}.${filtype}`;
    return {
      opplastUrl: await this.signer(nokkel, 'PUT'),
      lesUrl: `${this.offentligBase}/${nokkel}`,
    };
  }
}
