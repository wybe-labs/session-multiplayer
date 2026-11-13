/**
 * Oppslag på registreringsnummer. Kundereisen krever pris på ti sekunder,
 * så dekkdimensjonen må hentes, ikke skrives inn.
 *
 * Statens vegvesen har et åpent API for kjøretøyopplysninger som krever
 * API-nøkkel. Til piloten holder det med en falsk kilde og en tabell over
 * de vanligste bilene, så hele flyten kan testes uten avtale.
 */
import { parseDimensjon, type Kjoretoy, normaliserRegnr } from '@skodd/core';

export interface Kjoretoyregister {
  slaOpp(regnr: string): Promise<Kjoretoy | null>;
}

const FALSKE: Record<string, Omit<Kjoretoy, 'regnr'>> = {
  AB12345: {
    merke: 'Volkswagen', modell: 'Golf', arsmodell: 2019, type: 'personbil',
    drivstoff: 'bensin', vektKg: 1350, dimensjonFor: parseDimensjon('205/55R16 91V'),
  },
  EK54321: {
    merke: 'Tesla', modell: 'Model Y', arsmodell: 2023, type: 'suv',
    drivstoff: 'elektrisk', vektKg: 2100, dimensjonFor: parseDimensjon('255/45R19 104W'),
  },
  EL11223: {
    merke: 'Volvo', modell: 'XC40 Recharge', arsmodell: 2024, type: 'suv',
    drivstoff: 'elektrisk', vektKg: 2150, dimensjonFor: parseDimensjon('235/50R19 103V'),
  },
  BS99887: {
    merke: 'Toyota', modell: 'Yaris', arsmodell: 2017, type: 'personbil',
    drivstoff: 'hybrid', vektKg: 1120, dimensjonFor: parseDimensjon('185/60R15 84H'),
  },
  CV45678: {
    merke: 'Porsche', modell: 'Taycan', arsmodell: 2022, type: 'ytelsesbil',
    drivstoff: 'elektrisk', vektKg: 2300, dimensjonFor: parseDimensjon('245/45R20 103Y'),
  },
};

/** Faller tilbake på en gjennomsnittsbil, så ingen kunde møter en blindvei. */
const STANDARD: Omit<Kjoretoy, 'regnr'> = {
  merke: 'Ukjent', modell: 'Ukjent', arsmodell: 2018, type: 'personbil',
  drivstoff: 'bensin', vektKg: 1500, dimensjonFor: parseDimensjon('205/55R16 91V'),
};

export class FalskKjoretoyregister implements Kjoretoyregister {
  constructor(private readonly ekstra: Record<string, Omit<Kjoretoy, 'regnr'>> = {}) {}

  async slaOpp(regnr: string): Promise<Kjoretoy | null> {
    const n = normaliserRegnr(regnr);
    const treff = this.ekstra[n] ?? FALSKE[n] ?? STANDARD;
    return { regnr: n, ...treff };
  }
}

/**
 * Statens vegvesen, enkeltoppslag. Krever SVV-API-nøkkel.
 * Settes i drift når avtalen er på plass; til da brukes den falske kilden.
 */
export class SvvKjoretoyregister implements Kjoretoyregister {
  constructor(
    private readonly apiNokkel: string,
    private readonly reserve: Kjoretoyregister = new FalskKjoretoyregister(),
    private readonly base = 'https://akfell-datautlevering.atlas.vegvesen.no',
  ) {}

  async slaOpp(regnr: string): Promise<Kjoretoy | null> {
    const n = normaliserRegnr(regnr);
    try {
      const svar = await fetch(
        `${this.base}/enkeltoppslag/kjoretoydata?kjennemerke=${encodeURIComponent(n)}`,
        { headers: { SVV_AUTHORIZATION: this.apiNokkel, Accept: 'application/json' } },
      );
      if (!svar.ok) return this.reserve.slaOpp(n);
      const data = (await svar.json()) as SvvSvar;
      return tolkSvv(n, data) ?? this.reserve.slaOpp(n);
    } catch {
      return this.reserve.slaOpp(n);
    }
  }
}

interface SvvSvar {
  kjoretoydataListe?: {
    godkjenning?: {
      tekniskGodkjenning?: {
        tekniskeData?: {
          akslinger?: { akselGruppe?: { akselListe?: { aksel?: { dekkOgFelg?: { dekkOgFelgKombinasjon?: { dekkdimensjon?: string }[] }[] }[] }[] } };
          vekter?: { egenvekt?: number };
          generelt?: { merke?: { merke?: string }[]; handelsbetegnelse?: string[] };
          motorOgDrivverk?: { motor?: { drivstoff?: { drivstoffKode?: { kodeNavn?: string } }[] }[] };
        };
      };
    };
    forstegangsregistrering?: { registrertForstegangNorgeDato?: string };
  }[];
}

function tolkSvv(regnr: string, data: SvvSvar): Kjoretoy | null {
  const k = data.kjoretoydataListe?.[0];
  const td = k?.godkjenning?.tekniskGodkjenning?.tekniskeData;
  const dimTekst = td?.akslinger?.akselGruppe?.akselListe?.[0]?.aksel?.[0]
    ?.dekkOgFelg?.[0]?.dekkOgFelgKombinasjon?.[0]?.dekkdimensjon;
  if (!dimTekst) return null;
  const drivstoffNavn = td?.motorOgDrivverk?.motor?.[0]?.drivstoff?.[0]?.drivstoffKode?.kodeNavn ?? '';
  const drivstoff: Kjoretoy['drivstoff'] = /elek/i.test(drivstoffNavn)
    ? 'elektrisk'
    : /hybrid/i.test(drivstoffNavn)
      ? 'hybrid'
      : /diesel/i.test(drivstoffNavn)
        ? 'diesel'
        : /bensin/i.test(drivstoffNavn)
          ? 'bensin'
          : 'annet';
  const vekt = td?.vekter?.egenvekt;
  return {
    regnr,
    merke: td?.generelt?.merke?.[0]?.merke ?? 'Ukjent',
    modell: td?.generelt?.handelsbetegnelse?.[0] ?? 'Ukjent',
    arsmodell: Number(k?.forstegangsregistrering?.registrertForstegangNorgeDato?.slice(0, 4) ?? 0) || 2018,
    type: (vekt ?? 0) >= 1900 ? 'suv' : 'personbil',
    drivstoff,
    ...(vekt ? { vektKg: vekt } : {}),
    dimensjonFor: parseDimensjon(dimTekst),
  };
}
