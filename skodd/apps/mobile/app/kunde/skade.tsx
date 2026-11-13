import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HJUL, HJULNAVN, type Hjulposisjon } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Felt } from '../../src/komponenter/Felt.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { useMittAbonnement } from '../../src/bruk.ts';
import { api, ApiFeil } from '../../src/api.ts';
import { aksentNa, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';

type Skadetype = 'punktering' | 'odelagt_dekk' | 'felg' | 'kollisjon' | 'annet';

const TYPER: { id: Skadetype; navn: string; forklaring: string }[] = [
  { id: 'punktering', navn: 'Punktering', forklaring: 'Kan repareres. Inkludert, og fikset innen 48 timer.' },
  { id: 'odelagt_dekk', navn: 'Ødelagt dekk', forklaring: 'Kutt i sideveggen eller kantstein. Ett per 24 mnd er inkludert.' },
  { id: 'felg', navn: 'Felg', forklaring: 'Bøyd eller sprukket. Dekkes av Felg+. Riper dekkes ikke.' },
  { id: 'kollisjon', navn: 'Kollisjon eller hærverk', forklaring: 'Dokumenteres og faktureres bilforsikringen.' },
  { id: 'annet', navn: 'Noe annet', forklaring: 'Beskriv det, så tar vi kontakt.' },
];

export default function Skade() {
  const router = useRouter();
  const { data } = useMittAbonnement();
  const aksent = aksentNa();
  const [type, settType] = useState<Skadetype | null>(null);
  const [posisjon, settPosisjon] = useState<Hjulposisjon | null>(null);
  const [beskrivelse, settBeskrivelse] = useState('');
  const [sender, settSender] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const [kvittering, settKvittering] = useState<{ egenandelOre: number; dekkesAv: string; frist: string | null } | null>(null);

  const send = async () => {
    if (!data || !type) return;
    settFeil(null);
    settSender(true);
    try {
      const svar = await api.meldSkade({
        abonnementId: data.abonnement.id,
        type,
        ...(posisjon ? { posisjon } : {}),
        beskrivelse: beskrivelse.trim(),
      });
      settKvittering(svar);
    } catch (e) {
      settFeil(e instanceof ApiFeil ? e.message : 'Vi fikk ikke sendt meldingen.');
    } finally {
      settSender(false);
    }
  };

  if (kvittering) {
    return (
      <Skjerm
        tittel="Vi har meldingen"
        undertittel="Vi ringer for å avtale tid."
        bunn={<Knapp tittel="Tilbake" aksent={aksent} onPress={() => router.back()} />}
      >
        <Kort tittel="Dette gjelder">
          <Rad venstre="Dekkes av" hoyre={dekkesTekst(kvittering.dekkesAv)} />
          <Rad venstre="Egenandel" hoyre={kvittering.egenandelOre ? formatterKr(kvittering.egenandelOre) : 'Ingen'} />
          {kvittering.frist ? <Rad venstre="Reparert innen" hoyre="48 timer" /> : null}
        </Kort>
      </Skjerm>
    );
  }

  return (
    <Skjerm
      tittel="Meld skade"
      undertittel="Ta bilde hvis du kan. Det gjør resten enklere."
      bunn={
        <>
          {feil ? <Text style={[t.liten, { color: farge.varsel }]}>{feil}</Text> : null}
          <Knapp
            tittel="Send melding"
            aksent={aksent}
            av={!type || beskrivelse.trim().length < 5}
            laster={sender}
            onPress={send}
          />
          <Knapp tittel="Avbryt" variant="tekst" onPress={() => router.back()} />
        </>
      }
    >
      {TYPER.map((x) => {
        const valgt = type === x.id;
        return (
          <Pressable
            key={x.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: valgt }}
            onPress={() => settType(x.id)}
            style={{
              borderWidth: 1, borderColor: valgt ? aksent : farge.kant,
              backgroundColor: valgt ? farge.flate : 'transparent',
              borderRadius: radius.md, padding: spor.md, gap: 2,
            }}
          >
            <Text style={{ fontFamily: skrift.brodtekstHalvfet, fontSize: 16 }}>{x.navn}</Text>
            <Text style={t.liten}>{x.forklaring}</Text>
          </Pressable>
        );
      })}

      {type && type !== 'kollisjon' && type !== 'annet' ? (
        <Kort tittel="Hvilket hjul">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spor.sm }}>
            {HJUL.map((pos) => {
              const valgt = posisjon === pos;
              return (
                <Pressable
                  key={pos}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: valgt }}
                  accessibilityLabel={HJULNAVN[pos]}
                  onPress={() => settPosisjon(pos)}
                  style={{
                    paddingHorizontal: spor.md, paddingVertical: spor.sm,
                    borderRadius: radius.pille, borderWidth: 1,
                    borderColor: valgt ? aksent : farge.kant,
                    backgroundColor: valgt ? aksent : 'transparent',
                  }}
                >
                  <Text style={{ color: valgt ? farge.bakgrunn : farge.tekst, fontFamily: skrift.brodtekstMedium }}>
                    {pos}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Kort>
      ) : null}

      <Felt
        etikett="Hva skjedde"
        value={beskrivelse}
        onChangeText={settBeskrivelse}
        placeholder="Kjørte i en kantstein på Ring 3. Dekket står flatt."
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
    </Skjerm>
  );
}

const dekkesTekst = (dekkesAv: string): string =>
  ({ skodd: 'Skodd', felg_pluss: 'Felg+', kunde: 'Deg', bilforsikring: 'Bilforsikringen' })[dekkesAv] ?? dekkesAv;
