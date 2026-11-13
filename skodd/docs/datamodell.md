# Datamodell

Alle id-er er uuid fra appen, alle beløp er `bigint` i øre, alle tidspunkter er
`timestamptz`. Migrasjonene ligger i `apps/api/migrations` og kjøres i rekkefølge
ved oppstart.

```
kunder ──< abonnementer >── kjoretoy
             │   │   │
             │   │   └──< dekksett >── lagre
             │   │            │
             │   │            └──< malinger >── jobber >── montorer
             │   │                                 │
             │   ├──< skademeldinger               └── vinduer
             │   ├──< nps_svar
             │   └──< hendelser
steder ──────┘ (og jobber)
reservasjoner, kampanjekoder, engangskoder står for seg
```

## Tabellene

| Tabell | Hva den holder |
|---|---|
| `kunder` | Mobilnummer er identiteten. Rollen avgjør hva appen viser |
| `kjoretoy` | Oppslag fra kjøretøyregisteret, med dekkdimensjon som jsonb |
| `abonnementer` | Pakke, tillegg, pris, status, sted, depositum, binding |
| `dekksett` | To per abonnement. Hvem som eide det, hvor det står, hvor mange sesonger det har gått |
| `malinger` | Fire hjul à tre punkter, kilometerstand, bilder. Kjernen i datafangsten |
| `jobber` | Ett skift. Knyttet til vindu, sted og montør |
| `vinduer` | De to seksukersvinduene per år, med den lovpålagte fristen |
| `steder` | Borettslag, arbeidsplasser og garasjeanlegg, med avtalestatus |
| `lagre` | Lagerpartner, hyllemeter og kapasitet. Gate 2 krever én aktiv |
| `montorer` | Knyttet til en kunde-rad med rollen `montor` |
| `skademeldinger` | Type, egenandel og hvem som dekker, etter tabellen i vilkårene |
| `reservasjoner` | Forhåndsbestilling fra landingssiden. Gate 1 teller disse |
| `kampanjekoder` | Nabokoden og borettslagskoder, med antall bruk |
| `engangskoder` | Hash av innloggingskoden, med utløp og forsøksteller |
| `nps_svar` | Score 0–10 per jobb. Gate 3 krever NPS ≥ 60 |
| `hendelser` | Hendelseslogg: tilbud vist, depositum betalt, skift utført, dekk må byttes |

## Hvorfor hendelsesloggen

`hendelser` er ikke ettertanke. Kostnad per skift hentes derfra når ruter
tildeles, og nøkkeltallene til gatene regnes ut av den. Den gir også grunnlaget
for det konseptet kaller datavirksomheten: når trengte denne bilen nye dekk,
hvor fort slet den, hvilke dimensjoner går mest.

## Livsløpet til et dekksett

```
pa_lager ──► pa_bil ──► pa_lager (+1 brukt sesong) ──► ... ──► utslitt
                                                                 │
                                        hendelse «dekk.ma_byttes» ┘
                                        → drift kjøper nytt sett
```

Et sett kunden kom med står som `viKjopte: false` og teller ikke i utkjøpet ved
oppsigelse. Først når vi har kjøpt settet, har det en restverdi kunden må kjøpe ut.

## Målingene

Hver måling er fire hjul med `innerMm`, `midtMm` og `ytterMm`. Minste verdi
styrer alt: tilstanden til settet, prognosen, og om settet må byttes. Spenn over
1,5 mm innenfor ett dekk flagges som skjev slitasje, som nesten alltid betyr
feil lufttrykk eller skjev framstilling, og som kunden skal få vite om.

Slitasjeraten krever to målinger på samme sett med minst 2000 km mellom seg.
Før det brukes en standardrate som skiller mellom lette og tunge biler, siden
tunge elbiler sliter merkbart fortere.
