# Drift

## Sesongen

Året har to vinduer på seks uker. Vårvinduet slutter en uke etter piggfristen,
som er første mandag etter 2. påskedag, og høstvinduet ligger rundt 1. november.
Datoene regnes ut, ikke skrives inn: påskedag flytter seg, og Nord-Norge har
egne faste datoer.

```
POST /v1/ops/vinduer            { ar: 2027 }        # én gang i året
POST /v1/ops/vinduer/:id/planlegg                   # når vinduet åpner
POST /v1/ops/dager              { vinduId, dato, montorId }   # hver morgen
POST /v1/ops/paminnelser        { dato }            # kvelden før
```

`dager` grupperer jobbene på sted, tettest sted først, og svarer med kostnad per
skift og om ruten består Gate 3. Går den over 300 kr, er svaret alltid det samme:
færre stopp, flere biler per stopp.

## Gatene

Nøkkeltallene hentes med `GET /v1/ops/noktall` og måles mot kravene i planen.

| Gate | Dato | Krav | Hvis ikke |
|---|---|---|---|
| 1 | 15. jan 2027 | 150 reservasjoner og 3 borettslag som sier ja | Endre pris eller kanal, ny test i fire uker |
| 2 | 15. mars 2027 | 100 betalte depositum og avtale med lagerpartner | Vi stopper og betaler tilbake depositumene |
| 3 | 14. mai 2027 | Kostnad per skift ≤ 300 kr, NPS ≥ 60, under 10 % vil si opp | Vi justerer modellen før høstsesongen |

Alle tre måles på levende data fra systemet. Ingen av dem krever at noen fører
et regneark.

## Før første skift

- [ ] SVV-nøkkel for oppslag på kjennemerke. Til da brukes den falske kilden,
      som gir en gjennomsnittsbil og dermed feil pakke for noen biler.
- [ ] Stripe-konto, og webhooken pekt på `/v1/webhooks/betaling`.
- [ ] SMS-leverandør med godkjent avsendernavn «Skodd».
- [ ] S3-kompatibelt bildelager, og `S3Bildelager` koblet inn i `app.ts`.
- [ ] Juridisk gjennomgang av vilkårene: binding, angrerett og utkjøp av restverdi.
- [ ] Ekte Postgres med sikkerhetskopi. `DATABASE_URL` peker dit.
- [ ] `JWT_HEMMELIGHET` og `KODE_PEPPER` satt til ekte verdier, ikke standardene.
- [ ] Ansvarsforsikring, og standardiserte tiltrekkingsmomenter per bilmerke
      lagt inn som liste montøren kan slå opp i.

## Daglig

| Når | Hva |
|---|---|
| Morgen | Tildel dagen til hver montør. Sjekk kostnad per skift |
| Kveld før | Send påminnelser |
| Etter hvert skift | Ingenting. SMS går automatisk med mønsterdybde |
| Ukentlig | Gå gjennom hendelsen `dekk.ma_byttes` og bestill nye sett |
| Ukentlig | Se på nøkkeltallene mot nærmeste gate |

## Når noe går galt

**Montøren får ikke opp jobber.** Jobben må være tildelt en montør på den datoen.
Sjekk at `/ops/dager` er kjørt, og at montøren er knyttet til en kunde-rad med
rollen `montor`.

**Kunden fikk ikke SMS.** Hendelsesloggen viser om meldingen ble sendt. I
utvikling brukes mock-SMS og ingenting går ut.

**Depositumet står som ubetalt.** Webhooken må nå `/v1/webhooks/betaling` og
signaturen må stemme. Uten gyldig signatur svarer API-et 400 og endrer ingenting.

**Mønsteret ser feil ut.** Målinger kan ikke redigeres fra appen, med vilje. Legg
inn en ny måling ved neste skift; prognosen bruker alltid den nyeste.
