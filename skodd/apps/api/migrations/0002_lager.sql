-- Lagerpartner og hyllemeter. Gate 2 krever avtale med en lagerpartner.
CREATE TABLE lagre (
  id              uuid PRIMARY KEY,
  navn            text NOT NULL,
  adresse         text NOT NULL,
  partner         text,
  hyllemeter      integer NOT NULL DEFAULT 0,
  kapasitet_sett  integer NOT NULL DEFAULT 0,
  pris_per_sett_ar_ore bigint,
  aktiv           boolean NOT NULL DEFAULT true,
  opprettet       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dekksett ADD COLUMN lager_id uuid REFERENCES lagre(id);
