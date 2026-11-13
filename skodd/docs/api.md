# API

Base: `/v1`. JSON inn og ut. Beløp i øre. Feil kommer som
`{ "feil": "...", "detaljer": [{ "felt": "...", "melding": "..." }] }`.

## Åpent

| Metode | Sti | Hva |
|---|---|---|
| GET | `/helse` | Status |
| GET | `/pakker` | Pakker, tillegg, vilkår og merkevarefarger |
| POST | `/tilbud` | `{ regnr }` → bil, pris, sammenligning mot å gjøre det selv |
| POST | `/reservasjoner` | Forhåndsbestilling fra landingssiden. Telles i Gate 1 |
| POST | `/auth/kode` | Sender engangskode på SMS. Maks 5 per 10 min |
| POST | `/auth/bekreft` | `{ telefon, kode }` → JWT og rolle |
| POST | `/webhooks/betaling` | Signert webhook fra betalingsleverandøren |

## Kunde

Krever JWT.

| Metode | Sti | Hva |
|---|---|---|
| GET | `/meg` | Kunde og abonnementene |
| PATCH | `/meg` | Navn og e-post |
| POST | `/abonnementer` | Påmelding. Oppretter to dekksett og krever depositum |
| GET | `/abonnementer/:id` | Hovedskjermen: status, sett, mønster, prognose, neste vindu |
| GET | `/abonnementer/:id/malinger` | Målehistorikk, hjul for hjul |
| PUT | `/abonnementer/:id/tillegg` | Legg til eller fjern Felg+ og vask |
| GET | `/abonnementer/:id/oppsigelse` | Forhåndsvisning: binding og utkjøp av restverdi |
| POST | `/abonnementer/:id/oppsigelse` | Si opp |
| GET | `/vinduer` | Skiftvinduene, med anbefalt vindu |
| POST | `/jobber` | Book eller flytt skiftet i et vindu |
| GET | `/jobber` | Egne skift |
| POST | `/skade` | Skademelding. Svaret sier egenandel og hvem som dekker |
| POST | `/nps` | Score 0–10 etter et skift |
| POST | `/bilder/lenke` | Presignert opplasting, så bilder går rett fra mobilen |

## Montør

Krever rollen `montor` eller `ops`.

| Metode | Sti | Hva |
|---|---|---|
| GET | `/montor/jobber?dato=` | Dagens rute, gruppert på sted |
| POST | `/montor/jobber/:id/fullfor` | Mønster på fire hjul, km, moment. Sender SMS til kunden |
| POST | `/montor/bilder/lenke` | Opplasting av mønsterbilder |

`fullfor` er transaksjonen som driver hele datafangsten: målingen lagres,
settene bytter plass, brukte sesonger telles opp, prognosen regnes ut, avvik
flagges, og settet markeres utslitt hvis det er under grensen.

## Drift

Krever rollen `ops`.

| Metode | Sti | Hva |
|---|---|---|
| GET | `/ops/noktall` | Nøkkeltall, gatestatus, enhetsøkonomi og pilotbudsjett |
| GET | `/ops/gater` | Kravene i de tre gatene |
| POST | `/ops/vinduer` | Oppretter årets to vinduer. Idempotent |
| POST | `/ops/vinduer/:id/planlegg` | Lager en jobb per aktivt abonnement |
| POST | `/ops/dager` | Tildeler en dag til en montør, og priser ruten mot Gate 3 |
| POST | `/ops/paminnelser` | SMS til alle som får besøk den dagen |
| GET | `/ops/kapasitet` | Hvor mange biler et antall montører rekker |
| GET/POST/PATCH | `/ops/steder` | Borettslag og arbeidsplasser, med avtalestatus |
| POST | `/ops/lagre` | Lagerpartner og hyllemeter |
| GET/POST | `/ops/montorer` | Montører |

## Eksempel

```bash
curl -s localhost:8080/v1/tilbud -H 'content-type: application/json' \
  -d '{"regnr":"EK54321"}' | jq '.tilbud.manedspris, .tilbud.pakke.navn'
# 54900
# "Skodd Stor"
```
