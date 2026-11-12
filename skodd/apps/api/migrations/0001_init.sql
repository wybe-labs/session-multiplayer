-- Skodd, grunnskjema. Alle beløp i øre som bigint. Alle id-er er uuid fra appen.

CREATE TABLE kunder (
  id            uuid PRIMARY KEY,
  telefon       text NOT NULL UNIQUE,
  navn          text,
  epost         text,
  rolle         text NOT NULL DEFAULT 'kunde' CHECK (rolle IN ('kunde','montor','ops')),
  opprettet     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE steder (
  id            uuid PRIMARY KEY,
  navn          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('borettslag','arbeidsplass','hjemme','garasjeanlegg')),
  adresse       text NOT NULL,
  postnummer    text,
  lat           double precision,
  lon           double precision,
  avtalestatus  text NOT NULL DEFAULT 'prospekt' CHECK (avtalestatus IN ('prospekt','i_dialog','ja','nei')),
  antall_biler  integer,
  kontakt       text,
  opprettet     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kjoretoy (
  id            uuid PRIMARY KEY,
  regnr         text NOT NULL UNIQUE,
  merke         text NOT NULL,
  modell        text NOT NULL,
  arsmodell     integer NOT NULL,
  type          text NOT NULL CHECK (type IN ('personbil','suv','varebil','ytelsesbil')),
  drivstoff     text NOT NULL CHECK (drivstoff IN ('elektrisk','hybrid','bensin','diesel','annet')),
  vekt_kg       integer,
  dimensjon_for jsonb NOT NULL,
  dimensjon_bak jsonb,
  opprettet     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE abonnementer (
  id                uuid PRIMARY KEY,
  kunde_id          uuid NOT NULL REFERENCES kunder(id),
  kjoretoy_id       uuid NOT NULL REFERENCES kjoretoy(id),
  pakke             text NOT NULL CHECK (pakke IN ('skodd','skodd_stor','skodd_premium')),
  tillegg           jsonb NOT NULL DEFAULT '[]'::jsonb,
  km_per_ar         integer NOT NULL DEFAULT 15000,
  manedspris_ore    bigint NOT NULL,
  status            text NOT NULL DEFAULT 'reservert'
                    CHECK (status IN ('reservert','venter_betaling','aktiv','pause','oppsagt','avsluttet')),
  sted_id           uuid REFERENCES steder(id),
  stedstype         text NOT NULL,
  adresse           jsonb,
  depositum_ore     bigint NOT NULL DEFAULT 0,
  depositum_betalt  timestamptz,
  betaling_ref      text,
  kampanjekode      text,
  egne_dekk         text NOT NULL DEFAULT 'begge_sett' CHECK (egne_dekk IN ('begge_sett','ett_sett','ingen')),
  startet           timestamptz,
  binding_slutt     timestamptz,
  oppsagt           timestamptz,
  opprettet         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX abonnementer_kunde_idx ON abonnementer(kunde_id);
CREATE INDEX abonnementer_status_idx ON abonnementer(status);

CREATE TABLE dekksett (
  id                   uuid PRIMARY KEY,
  abonnement_id        uuid NOT NULL REFERENCES abonnementer(id),
  sesong               text NOT NULL CHECK (sesong IN ('vinter','sommer')),
  dimensjon            jsonb NOT NULL,
  merke                text,
  modell               text,
  pigg                 boolean NOT NULL DEFAULT false,
  vi_kjopte            boolean NOT NULL DEFAULT false,
  innkjopspris_ore     bigint,
  kjopt_dato           date,
  status               text NOT NULL DEFAULT 'pa_lager'
                       CHECK (status IN ('pa_bil','pa_lager','utslitt','levert_tilbake')),
  lagerplass           text,
  levetid_sesonger     integer NOT NULL DEFAULT 4,
  brukte_sesonger      integer NOT NULL DEFAULT 0,
  opprettet            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dekksett_abonnement_idx ON dekksett(abonnement_id);

CREATE TABLE vinduer (
  id            uuid PRIMARY KEY,
  ar            integer NOT NULL,
  monterer      text NOT NULL CHECK (monterer IN ('vinter','sommer')),
  region        text NOT NULL DEFAULT 'sor' CHECK (region IN ('sor','nord')),
  start         date NOT NULL,
  slutt         date NOT NULL,
  lovpalagt_frist date,
  UNIQUE (ar, monterer, region)
);

CREATE TABLE montorer (
  id          uuid PRIMARY KEY,
  kunde_id    uuid REFERENCES kunder(id),
  navn        text NOT NULL,
  telefon     text NOT NULL,
  aktiv       boolean NOT NULL DEFAULT true
);

CREATE TABLE jobber (
  id              uuid PRIMARY KEY,
  abonnement_id   uuid NOT NULL REFERENCES abonnementer(id),
  vindu_id        uuid NOT NULL REFERENCES vinduer(id),
  sted_id         uuid REFERENCES steder(id),
  adresse         jsonb,
  monterer        text NOT NULL CHECK (monterer IN ('vinter','sommer')),
  status          text NOT NULL DEFAULT 'planlagt'
                  CHECK (status IN ('planlagt','tildelt','utfort','avlyst')),
  planlagt_dato   date,
  montor_id       uuid REFERENCES montorer(id),
  tillegg_vask    boolean NOT NULL DEFAULT false,
  henter_sett     boolean NOT NULL DEFAULT true,
  merknad         text,
  km_stand        integer,
  moment_nm       integer,
  fullfort        timestamptz,
  opprettet       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobber_dato_idx ON jobber(planlagt_dato);
CREATE INDEX jobber_abonnement_idx ON jobber(abonnement_id);
CREATE INDEX jobber_montor_idx ON jobber(montor_id, planlagt_dato);

CREATE TABLE malinger (
  id            uuid PRIMARY KEY,
  dekksett_id   uuid NOT NULL REFERENCES dekksett(id),
  jobb_id       uuid REFERENCES jobber(id),
  km_stand      integer NOT NULL,
  malt_dato     timestamptz NOT NULL DEFAULT now(),
  hjul          jsonb NOT NULL,
  min_mm        numeric(3,1) NOT NULL,
  malt_av       text,
  bilde_urler   jsonb NOT NULL DEFAULT '[]'::jsonb,
  opprettet     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX malinger_dekksett_idx ON malinger(dekksett_id, malt_dato);

CREATE TABLE skademeldinger (
  id              uuid PRIMARY KEY,
  abonnement_id   uuid NOT NULL REFERENCES abonnementer(id),
  type            text NOT NULL CHECK (type IN ('punktering','odelagt_dekk','felg','kollisjon','annet')),
  posisjon        text,
  beskrivelse     text NOT NULL,
  bilde_urler     jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'mottatt'
                  CHECK (status IN ('mottatt','planlagt','utfort','avvist')),
  egenandel_ore   bigint NOT NULL DEFAULT 0,
  dekkes_av       text NOT NULL DEFAULT 'skodd' CHECK (dekkes_av IN ('skodd','felg_pluss','kunde','bilforsikring')),
  frist           timestamptz,
  opprettet       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservasjoner (
  id              uuid PRIMARY KEY,
  telefon         text NOT NULL,
  regnr           text,
  epost           text,
  postnummer      text,
  kilde           text NOT NULL DEFAULT 'landingsside',
  kampanjekode    text,
  abonnement_id   uuid REFERENCES abonnementer(id),
  opprettet       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservasjoner_telefon_idx ON reservasjoner(telefon);

CREATE TABLE kampanjekoder (
  kode            text PRIMARY KEY,
  eier_kunde_id   uuid REFERENCES kunder(id),
  gratis_maneder  integer NOT NULL DEFAULT 1,
  kilde           text NOT NULL DEFAULT 'nabo' CHECK (kilde IN ('nabo','borettslag','arbeidsplass','annet')),
  brukt_antall    integer NOT NULL DEFAULT 0,
  maks_bruk       integer,
  aktiv           boolean NOT NULL DEFAULT true,
  opprettet       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE engangskoder (
  telefon     text PRIMARY KEY,
  kode_hash   text NOT NULL,
  utloper     timestamptz NOT NULL,
  forsok      integer NOT NULL DEFAULT 0
);

CREATE TABLE nps_svar (
  id              uuid PRIMARY KEY,
  abonnement_id   uuid NOT NULL REFERENCES abonnementer(id),
  jobb_id         uuid REFERENCES jobber(id),
  score           integer NOT NULL CHECK (score BETWEEN 0 AND 10),
  kommentar       text,
  opprettet       timestamptz NOT NULL DEFAULT now()
);

-- Hendelseslogg. Grunnlaget for datavirksomheten bak dekkservicen.
CREATE TABLE hendelser (
  id              uuid PRIMARY KEY,
  type            text NOT NULL,
  abonnement_id   uuid REFERENCES abonnementer(id),
  jobb_id         uuid REFERENCES jobber(id),
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  opprettet       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hendelser_type_idx ON hendelser(type, opprettet);
