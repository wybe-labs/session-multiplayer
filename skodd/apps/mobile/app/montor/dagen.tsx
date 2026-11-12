import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DRIFTSANSLAG, GATE3_KOSTNAD_PER_SKIFT, minutterForJobb } from '@skodd/core';
import { Skjerm } from '../../src/komponenter/Skjerm.tsx';
import { Kort, Rad } from '../../src/komponenter/Kort.tsx';
import { Knapp } from '../../src/komponenter/Knapp.tsx';
import { Text } from '../../src/komponenter/Text.tsx';
import { Merke } from '../../src/komponenter/Merke.tsx';
import { RuteIkon } from '../../src/komponenter/Ikoner.tsx';
import { useAuth } from '../../src/auth.tsx';
import { useHentet } from '../../src/bruk.ts';
import { api, type MontorJobb } from '../../src/api.ts';
import { aksentNa, datoMedAr, farge, formatterKr, radius, skrift, spor, t } from '../../src/tema.ts';

const idag = (): string => new Date().toISOString().slice(0, 10);

export default function Dagen() {
  const router = useRouter();
  const { loggUt } = useAuth();
  const aksent = aksentNa();
  const [dato, settDato] = useState(idag());
  const { data, laster, feil, last } = useHentet(() => api.montorJobber(dato), [dato]);

  const jobber = data?.jobber ?? [];
  const gjenstar = jobber.filter((j) => j.status !== 'utfort');
  const grupper = grupper_per_sted(gjenstar);

  // Samme regnestykke som driftssystemet: tid og kostnad per skift på ruten.
  const minutter = grupper.reduce(
    (sum, g) => sum + g.jobber.reduce((s, j) => s + minutterForJobb(g.jobber.length, j.tilleggVask), 0),
    0,
  ) + Math.max(0, grupper.length - 1) * DRIFTSANSLAG.minutterMellomSteder;
  const kostnad = gjenstar.length
    ? Math.round(
        ((minutter / 60) * DRIFTSANSLAG.montorTimeprisOre
          + (minutter / DRIFTSANSLAG.minutterPerDag) * DRIFTSANSLAG.varebilPerDagOre) / gjenstar.length,
      )
    : 0;

  return (
    <Skjerm>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Merke storrelse={22} aksent={aksent} />
        <Text style={t.etikett}>Montør</Text>
      </View>

      <View style={{ paddingTop: spor.md, gap: spor.xs }}>
        <Text style={t.h1}>{datoMedAr(dato)}</Text>
        <Text style={t.brodDempet}>
          {gjenstar.length} skift igjen · {Math.round(minutter / 60)} t {minutter % 60} min
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spor.sm }}>
        <Knapp tittel="I dag" variant={dato === idag() ? 'primar' : 'sekundar'} aksent={aksent}
          style={{ flex: 1 }} onPress={() => settDato(idag())} />
        <Knapp tittel="I morgen" variant="sekundar" style={{ flex: 1 }}
          onPress={() => settDato(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))} />
      </View>

      {gjenstar.length ? (
        <Kort tittel="Ruten" hoyre={<RuteIkon farge={aksent} storrelse={18} />}>
          <Rad venstre="Stopp" hoyre={`${grupper.length}`} />
          <Rad venstre="Kostnad per skift" hoyre={formatterKr(kostnad)} />
          <Text style={[t.liten, { color: kostnad <= GATE3_KOSTNAD_PER_SKIFT ? farge.ok : farge.sol }]}>
            {kostnad <= GATE3_KOSTNAD_PER_SKIFT
              ? `Innenfor målet på ${formatterKr(GATE3_KOSTNAD_PER_SKIFT)} per skift.`
              : `Over målet på ${formatterKr(GATE3_KOSTNAD_PER_SKIFT)}. Færre stopp, flere biler per sted.`}
          </Text>
        </Kort>
      ) : null}

      {laster ? <ActivityIndicator color={aksent} /> : null}
      {feil ? (
        <Kort tittel="Feil">
          <Text style={t.brod}>{feil}</Text>
          <Knapp tittel="Prøv igjen" variant="sekundar" onPress={() => void last()} />
        </Kort>
      ) : null}

      {grupper.map((g) => (
        <View key={g.navn} style={{ gap: spor.sm }}>
          <Text style={t.h3}>{g.navn}</Text>
          <Text style={t.liten}>{g.adresse}</Text>
          {g.jobber.map((j) => (
            <Pressable
              key={j.id}
              accessibilityRole="button"
              onPress={() => router.push(`/montor/${j.id}`)}
              style={{
                borderWidth: 1, borderColor: farge.kant, backgroundColor: farge.flate,
                borderRadius: radius.md, padding: spor.md,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: skrift.overskriftMedium, fontSize: 18, letterSpacing: 1 }}>
                  {j.regnr.slice(0, 2)} {j.regnr.slice(2)}
                </Text>
                <Text style={t.liten}>
                  {j.monterer === 'sommer' ? 'Sommerdekk på' : 'Vinterdekk på'}
                  {j.tilleggVask ? ' · vask' : ''}
                  {j.henterSett ? ' · hent sett' : ''}
                </Text>
              </View>
              <Text style={[t.brod, { color: aksent }]}>Åpne</Text>
            </Pressable>
          ))}
        </View>
      ))}

      {!laster && !gjenstar.length && !feil ? (
        <Kort tittel="Ingen flere skift">
          <Text style={t.brod}>Dagen er gjort. {jobber.length ? `${jobber.length} skift utført.` : ''}</Text>
        </Kort>
      ) : null}

      <Knapp tittel="Logg ut" variant="tekst" onPress={() => void loggUt()} />
    </Skjerm>
  );
}

interface Gruppe { navn: string; adresse: string; jobber: MontorJobb[] }

/** Tettest sted først, slik ruten faktisk kjøres. */
function grupper_per_sted(jobber: MontorJobb[]): Gruppe[] {
  const kart = new Map<string, Gruppe>();
  for (const j of jobber) {
    const navn = j.sted?.navn ?? (j.adresse?.['gate'] as string | undefined) ?? 'Hjemme';
    const adresse = j.sted?.adresse
      ?? [j.adresse?.['gate'], j.adresse?.['postnummer'], j.adresse?.['poststed']].filter(Boolean).join(' ');
    const gruppe = kart.get(navn) ?? { navn, adresse, jobber: [] };
    gruppe.jobber.push(j);
    kart.set(navn, gruppe);
  }
  return [...kart.values()].sort((a, b) => b.jobber.length - a.jobber.length);
}
