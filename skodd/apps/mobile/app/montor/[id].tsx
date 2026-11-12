import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  HJUL, HJULNAVN, LOVLIG_MIN_MM, NYTT_MM, SKODD_GRENSE_MM, finnAvvik,
  type HjulMaling, type Sesong,
} from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad, Skille } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { Mmvelger } from '../../src/komponenter/Mmvelger.tsx';
import { useHentet } from '../../src/bruk.ts';
import { api, ApiFeil } from '../../src/api.ts';
import { aksentNa, farge, radius, skrift, spor, t } from '../../src/tema.ts';

const idag = (): string => new Date().toISOString().slice(0, 10);

const tomtSett = (sesong: Sesong): HjulMaling[] =>
  HJUL.map((posisjon) => ({
    posisjon,
    innerMm: NYTT_MM[sesong],
    midtMm: NYTT_MM[sesong],
    ytterMm: NYTT_MM[sesong],
  }));

export default function JobbSkjerm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const aksent = aksentNa();

  const { data } = useHentet(() => api.montorJobber(idag()), []);
  const jobb = data?.jobber.find((j) => j.id === id) ?? null;
  const monterer: Sesong = jobb?.monterer ?? 'sommer';

  const [kmStand, settKmStand] = useState('');
  const [moment, settMoment] = useState('120');
  const [hjul, settHjul] = useState<HjulMaling[]>(() => tomtSett(monterer));
  const [merknad, settMerknad] = useState('');
  const [sender, settSender] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const [ferdig, settFerdig] = useState<{ monsterTekst: string; maBytteSett: boolean } | null>(null);

  const avvik = useMemo(
    () => finnAvvik({ dekksettId: 'ny', kmStand: 0, maltDato: new Date(), hjul }, monterer),
    [hjul, monterer],
  );

  const settHjulVerdi = (posisjon: string, felt: keyof HjulMaling, verdi: number) => {
    settHjul((f) => f.map((h) => (h.posisjon === posisjon ? { ...h, [felt]: verdi } : h)));
  };

  const km = Number(kmStand.replace(/\s/g, ''));
  const klar = km > 0 && km < 2_000_000;

  const fullfor = async () => {
    if (!jobb) return;
    settFeil(null);
    settSender(true);
    try {
      const svar = await api.fullforJobb(jobb.id, {
        kmStand: km,
        monterteSesong: monterer,
        hjul,
        ...(Number(moment) ? { momentNm: Number(moment) } : {}),
        ...(merknad.trim() ? { merknad: merknad.trim() } : {}),
        henterSett: jobb.henterSett,
      });
      settFerdig({ monsterTekst: svar.monsterTekst, maBytteSett: svar.maBytteSett });
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Fikk ikke lagret. Prøv igjen.');
    } finally {
      settSender(false);
    }
  };

  if (ferdig) {
    return (
      <Skjerm
        tittel="Skiftet er registrert"
        undertittel="Kunden har fått SMS med mønsterdybden."
        bunn={<Knapp tittel="Tilbake til ruten" aksent={aksent} onPress={() => router.replace('/montor/dagen')} />}
      >
        <Kort tittel="Sendt til kunden">
          <Text style={t.brod}>{ferdig.monsterTekst}</Text>
        </Kort>
        {ferdig.maBytteSett ? (
          <Kort tittel="Merk">
            <Text style={[t.brod, { color: farge.sol }]}>
              Settet er under grensen. Drift bestiller nytt sett før neste sesong.
            </Text>
          </Kort>
        ) : null}
      </Skjerm>
    );
  }

  if (!jobb) {
    return (
      <Skjerm tittel="Jobben" undertittel="Fant ikke jobben på dagens rute."
        bunn={<Knapp tittel="Tilbake" aksent={aksent} onPress={() => router.back()} />}>
        <View />
      </Skjerm>
    );
  }

  return (
    <Skjerm
      tittel={`${jobb.regnr.slice(0, 2)} ${jobb.regnr.slice(2)}`}
      undertittel={`${monterer === 'sommer' ? 'Sommerdekk på' : 'Vinterdekk på'} · ${jobb.sted?.navn ?? 'hjemme'}`}
      bunn={
        <>
          {feil ? <Text style={[t.liten, { color: farge.varsel }]}>{feil}</Text> : null}
          <Knapp tittel="Fullfør skiftet" aksent={aksent} av={!klar} laster={sender} onPress={fullfor} />
        </>
      }
    >
      <Kort tittel="Jobben">
        <Rad venstre="Kunde" hoyre={jobb.kunde.navn ?? jobb.kunde.telefon} />
        <Rad venstre="Telefon" hoyre={jobb.kunde.telefon} dempet />
        {jobb.tilleggVask ? <Rad venstre="Vask" hoyre="Bestilt" /> : null}
        <Rad venstre="Hent settet som tas av" hoyre={jobb.henterSett ? 'Ja' : 'Nei'} dempet />
        {jobb.merknad ? <Text style={t.liten}>{jobb.merknad}</Text> : null}
      </Kort>

      <Kort tittel="Kilometerstand">
        <Felt
          value={kmStand}
          onChangeText={(v) => settKmStand(v.replace(/\D/g, ''))}
          placeholder="48000"
          keyboardType="number-pad"
          hjelp="Kilometerstanden er det som gjør slitasjen målbar. Den må inn."
        />
      </Kort>

      <Text style={t.h3}>Mønster på settet du setter på</Text>
      <Text style={t.liten}>
        Tre punkter per dekk: innerkant, midten, ytterkant. Lovkrav {LOVLIG_MIN_MM[monterer].toString().replace('.', ',')} mm,
        vår grense {SKODD_GRENSE_MM[monterer].toString().replace('.', ',')} mm.
      </Text>

      {hjul.map((h) => (
        <View
          key={h.posisjon}
          style={{
            borderWidth: 1, borderColor: farge.kant, backgroundColor: farge.flate,
            borderRadius: radius.md, padding: spor.md, gap: spor.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: skrift.overskriftMedium, fontSize: 17 }}>
              {h.posisjon} · {HJULNAVN[h.posisjon]}
            </Text>
            <Text style={[t.liten, { color: aksent }]}>
              min {Math.min(h.innerMm, h.midtMm, h.ytterMm).toFixed(1).replace('.', ',')} mm
            </Text>
          </View>
          <View style={{ gap: spor.sm }}>
            <Mmvelger etikett="Inner" verdi={h.innerMm} aksent={aksent}
              settVerdi={(n) => settHjulVerdi(h.posisjon, 'innerMm', n)} />
            <Mmvelger etikett="Midt" verdi={h.midtMm} aksent={aksent}
              settVerdi={(n) => settHjulVerdi(h.posisjon, 'midtMm', n)} />
            <Mmvelger etikett="Ytter" verdi={h.ytterMm} aksent={aksent}
              settVerdi={(n) => settHjulVerdi(h.posisjon, 'ytterMm', n)} />
          </View>
        </View>
      ))}

      {avvik.length ? (
        <Kort tittel="Avvik">
          {avvik.map((a, i) => (
            <Text key={`${a.posisjon}-${i}`} style={[t.liten, { color: a.type === 'under_lovlig' ? farge.varsel : farge.sol }]}>
              {a.posisjon}: {a.detalj}
            </Text>
          ))}
          <Skille />
          <Text style={t.liten}>Avvik følger med til kunden og til drift. Ta bilde av det du ser.</Text>
        </Kort>
      ) : null}

      <Kort tittel="Tiltrekkingsmoment">
        <Felt
          value={moment}
          onChangeText={(v) => settMoment(v.replace(/\D/g, ''))}
          placeholder="120"
          keyboardType="number-pad"
          hjelp="Nm. Dokumenteres mot skadekrav."
        />
      </Kort>

      <Felt
        etikett="Merknad"
        value={merknad}
        onChangeText={settMerknad}
        placeholder="Rust på én hjulbolt. Kunden er varslet."
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
    </Skjerm>
  );
}
