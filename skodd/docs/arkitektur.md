# Arkitektur

## Prinsippet

Konseptet sier «ingen app i starten»: landingsside, Stripe, et bookingverktøy,
Airtable og SMS. Det er riktig for å teste etterspørsel, men feil fra det
øyeblikket første skift skjer, fordi den viktigste ressursen i Skodd er
mønsterdata per bil. Et regneark fanger ikke fire hjul, tre målepunkter,
kilometerstand og bilder, og uten den fangsten finnes ikke datavirksomheten
konseptet bygger på.

Derfor er dette bygget slik: appen er montørens måleverktøy først, og kundens
abonnementsflate etterpå. Landingssiden og Airtable kan fortsatt leve ved siden
av til Gate 1.

## Tre deler

```
     Mobil (Expo)                 API (Fastify)              Postgres
  ┌────────────────┐          ┌──────────────────┐        ┌───────────┐
  │ Kunde          │  HTTPS   │ ruter            │        │ kunder    │
  │ Montør         │ ───────► │ tjenester        │ ─────► │ abonnement│
  │                │   JWT    │ adaptere         │        │ dekksett  │
  └────────────────┘          └──────────────────┘        │ malinger  │
          │                            │                  │ jobber    │
          └──────── @skodd/core ───────┘                  │ hendelser │
             pris · sesong · mønster                      └───────────┘
             rute · økonomi · gater
```

`@skodd/core` er delt mellom app og API. Prisen kunden ser i appen og prisen
API-et fakturerer er samme funksjon, og mønstergrensene montøren varsles på er
de samme som kunden ser. Metro leser pakken rett fra kilden
(`apps/mobile/metro.config.js`), så det finnes ingen byggetrinn som kan komme ut
av takt.

## Valg, og hvorfor

**Postgres, ikke Airtable.** Mønsterdata er tidsserier per dekksett. Prognosen
er en regresjon på to punkter i dag og flere senere. Det hører hjemme i en
database med fremmednøkler.

**PGlite i test.** Testene kjører mot ekte Postgres-SQL i prosessen, så
migrasjonene er bevist før de treffer drift. Ingen testcontainere, ingen
servere å starte i CI.

**tsx i drift, ikke et byggetrinn.** Én mindre ting som kan feile mellom
utvikling og produksjon. Byttes til kompilering den dagen oppstartstiden
betyr noe.

**Adaptere rundt alt eksternt.** Kjøretøyregister, betaling, SMS og bildelager
har hver sitt grensesnitt med en ekte og en falsk implementasjon. Hele
påmeldingen og hele skiftet kan kjøres uten en eneste avtale på plass, og
piloten kan starte mens SVV-nøkkelen fortsatt er på vei.

**Øre som heltall.** Ingen flyttall på penger noe sted.

**Norsk i koden.** Domenet er norsk: mønsterdybde, piggfrist, borettslag,
dekkhotell. Oversatte navn gjør bare at kode og virkelighet glir fra hverandre.

**Mobilappen er ikke i npm-arbeidsområdet.** Expo vil ha sine egne versjoner av
React og TypeScript. Den har sin egen `node_modules`, og henter bare `@skodd/core`
gjennom Metro.

## Roller

| Rolle | Får | Eksempel |
|---|---|---|
| `kunde` | Egne abonnement, egne jobber, egne målinger | Hele kundeappen |
| `montor` | Dagens tildelte jobber, og å fullføre dem | Montørappen |
| `ops` | Planlegging, ruter, steder, lagre, nøkkeltall | Driftsflaten |

Eierskap sjekkes på hvert kall (`eierAbonnement`), ikke bare på rollen. En kunde
som ber om et annet abonnement får 404, ikke 403, så ingen id-er lekker.

## Sikkerhet

- Engangskode på SMS, hashet med pepper, fem minutters levetid, maks fem forsøk.
  Koden står aldri i et API-svar, heller ikke i utvikling.
- Rangering: fem kodeforespørsler per ti minutter, 300 kall per minutt ellers.
  Grensen er bevist i egen test mot produksjonsoppsettet.
- Webhooks verifiseres med HMAC over rå kropp, som derfor beholdes ved parsing.
- JWT i nøkkelringen på enheten (`expo-secure-store`), i localStorage på web.

## Det som bevisst er utsatt

- **BankID.** Mobilnummer holder for en pilot. Binding på 24 måneder vil til slutt
  kreve sterkere identifikasjon, og vilkårene skal uansett gjennom en juridisk
  gjennomgang før lansering.
- **AI-måling av mønster.** Bildene lagres fra dag én, nettopp for å kunne trene
  på dem senere. Måling skjer manuelt til det finnes nok bilder.
- **Lagerplass ned på hyllenivå.** Feltet finnes på dekksettet, men
  plassoptimalisering venter til volumet er stort nok til at det betyr noe.
- **Varsler i appen.** SMS er kanalen i piloten, slik konseptet sier.
- **Kart og kjøreruter.** Ruten grupperes på sted og sorteres på tetthet.
  Avstandsoptimalisering gir lite når nesten alle stoppene er i samme garasje.
