# Skodd

Dekk som abonnement. Én fast månedspris, og bilen er alltid skodd for sesongen.
Vi henter, lagrer, skifter og fornyer. Kunden eier ingenting og trenger aldri tenke på det.

Dette er den tekniske siden av konseptet: mobilappen kunden og montøren bruker,
API-et bak den, og domenelogikken som pris, sesong, slitasje og rutekostnad regnes ut med.

```
skodd/
  packages/core      Domenekjernen: pris, sesong, mønster, rute, enhetsøkonomi, gater
  apps/api           Fastify + Postgres. Hele forretningslogikken bak ett API
  apps/mobile        Expo/React Native. Kundeapp og montørapp i samme binær
  infra              Dockerfile, docker-compose, CI
  docs               Arkitektur, datamodell, API-oversikt og driftsrutiner
```

## Kom i gang

```bash
cd skodd
npm install
npm test                 # 26 tester: domenekjernen og hele API-et
npm run db:seed          # testdata: borettslag, lager, montør, tre kunder
npm run dev:api          # http://localhost:8080

cd apps/mobile
npm install
npm start                # Expo: i, a eller w
```

Vil du bare se appen i en nettleser, uten Expo på telefonen:

```bash
UTVIKLING_FAST_KODE=123456 npm run dev:api     # i ett vindu
npm run preview                                # i et annet: http://localhost:8070
```

Da ligger app og API bak samme port, og du logger inn med koden `123456`.
Etter `npm run db:seed` finnes kunden `910 00 001` og montøren `900 00 002`.
Den faste koden ignoreres alltid når `NODE_ENV=production`.

Eller helt uten server: `npm run demo` lager `skodd-appen.html`, én selvstendig
fil med appen, fontene og demodata. Pris, sesong og mønster regnes fortsatt ut
av `@skodd/core`; bare lagringen er i minnet og nullstilles når siden lastes på
nytt. Koden er `123456`.

Uten konfigurasjon kjører alt lokalt uten eksterne avhengigheter: Postgres i
prosessen (PGlite), falskt kjøretøyregister, mock betaling og mock SMS.
I utvikling skrives engangskoden til innlogging i serverloggen, så du kommer
inn uten SMS-avtale. Se `.env.example` for det som må settes i drift.

## Appen

Én app, to moduser, styrt av rollen på brukeren.

**Kunde.** Registreringsnummer inn, pris ut på ti sekunder. Velg sted og dekk du
har fra før, godta vilkårene, betal depositum. Så: hjemskjerm med «Du er skodd»,
mønsterdybde per hjul med tre målepunkter, prognose for når settet må byttes,
booking av skiftvindu, tillegg som Felg+, skademelding og oppsigelse med utkjøp
beregnet av restverdien på dekk vi har kjøpt.

**Montør.** Dagens rute gruppert på sted, tettest sted først, med kostnad per
skift regnet ut mot Gate 3 mens du står der. Jobbskjermen tar kilometerstand,
mønster på fire hjul og tre punkter, tiltrekkingsmoment og merknad, flagger
skjev slitasje med en gang, og sender kunden SMS med mønsterdybden.

## API-et

Fastify, Postgres via Drizzle, JWT med engangskode på SMS, tre roller
(`kunde`, `montor`, `ops`). Alle beløp er heltall i øre.

Alt som er eget for Skodd er skilt ut bak adaptere, så piloten kan kjøre før
avtalene er på plass: kjøretøyregister (Statens vegvesen eller falskt), betaling
(Stripe eller mock), SMS (HTTP-leverandør eller mock) og bildelager (S3 eller mock).

Full oversikt i [docs/api.md](docs/api.md).

## Domenekjernen

`packages/core` er delt mellom app og API, så pris og mønsterregler finnes ett sted:

- **Pris og vilkår** fra konseptet: 399, 549 og 799 kr, 24 måneders binding,
  15 000 km inkludert, Felg+ 49 kr, 20 % for bil nummer to, utkjøp av restverdi.
- **Sesong**: påskedag regnes ut, piggfristen er første mandag etter 2. påskedag,
  Nord-Norge har faste datoer, og skiftvinduene er seks uker.
- **Mønster og slitasje**: minste måling styrer, skjev slitasje over 1,5 mm
  flagges, slitasjeraten regnes i mm per 1000 km, og prognosen sier hvor mange
  sesonger settet har igjen.
- **Rute og kapasitet**: tetthet gjør et skift billig, og modellen viser hvor mye.
- **Enhetsøkonomi og gater**: de tre gatene i planen måles på levende data.

## Hva tallene sier

Med konseptets egne anslag (3 500 kr per sett eks. mva., fire sesongers levetid,
250 kr per skift på tett rute) gir modellen **23,9 % bidragsmargin** ved full
dekkslitasje, mot anslaget på ca. 26 % i konseptdokumentet. Forskjellen er
postene dokumentet ikke spesifiserte: avsetning til skade, betalingskostnad og
support, til sammen ca. 465 kr per bil per år. Første år ligger marginen på
rundt 70 %, fordi kunden tar med egne dekk. Tallene er anslag til de er målt i piloten.

Rutemodellen på tre biler i samme garasje gir 154 kr per skift. Ett hjemmebesøk
alene lander på i overkant av 280 kr. Gate 3 krever 300 kr eller lavere, og det
er hele argumentet for borettslag og arbeidsplasser som kanal.

To montører i seks uker har kapasitet til rundt 960 biler, altså god margin på
pilotmålet om 300.

## Videre

Se [docs/drift.md](docs/drift.md) for hva som må på plass før første skift i
vårsesongen 2027, og [docs/arkitektur.md](docs/arkitektur.md) for valgene bak
oppsettet og hva som bevisst er utsatt.
