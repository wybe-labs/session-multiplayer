/**
 * SMS. Hele kundedialogen går på SMS i piloten: kvittering med mønsterdybde,
 * påminnelse før skift, kampanjekode til naboen.
 *
 * Stemmen er rolig, kort og tørr. Ingen utropstegn.
 */
export interface Melding {
  til: string;
  tekst: string;
  /** Til sporing i hendelsesloggen. */
  type: string;
}

export interface Sms {
  send(melding: Melding): Promise<{ ref: string }>;
}

export class MockSms implements Sms {
  readonly sendt: Melding[] = [];
  async send(melding: Melding): Promise<{ ref: string }> {
    this.sendt.push(melding);
    return { ref: `sms_${this.sendt.length}` };
  }
  sisteTil(telefon: string): Melding | undefined {
    return [...this.sendt].reverse().find((m) => m.til === telefon);
  }
}

/** Sveve eller Link Mobility. Begge tar POST med avsender, mottaker og tekst. */
export class HttpSms implements Sms {
  constructor(
    private readonly url: string,
    private readonly nokkel: string,
    private readonly avsender = 'Skodd',
  ) {}

  async send(melding: Melding): Promise<{ ref: string }> {
    const svar = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.nokkel}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: this.avsender, recipient: melding.til, text: melding.tekst }),
    });
    if (!svar.ok) throw new Error(`SMS feilet: ${svar.status}`);
    const data = (await svar.json()) as { messageId?: string };
    return { ref: data.messageId ?? 'ukjent' };
  }
}

export const MELDINGER = {
  engangskode: (kode: string): string =>
    `${kode} er koden din til Skodd. Den varer i fem minutter.`,

  depositumMottatt: (dato: string): string =>
    `Takk. Depositumet er registrert. Vi tar kontakt før første skift, ${dato}.`,

  pamminnelse: (dato: string, sted: string): string =>
    `Vi kommer ${dato} til ${sted}. Lås opp bilen, eller legg nøkkelen der vi ble enige om.`,

  skiftUtfort: (monsterTekst: string, nesteDato: string): string =>
    `Bilen er skodd. ${monsterTekst} Neste skift: ${nesteDato}.`,

  punkteringMottatt: (): string =>
    'Vi har meldingen. Dekket er reparert innen 48 timer, og vi ringer for å avtale tid.',

  nyttSettKommer: (monster: string): string =>
    `${monster} Vi setter på et nytt sett ved neste skift. Prisen din endres ikke.`,

  kampanjekode: (kode: string): string =>
    `Naboen får én måned gratis med koden ${kode}. Du får én måned gratis når de blir med.`,
} as const;
