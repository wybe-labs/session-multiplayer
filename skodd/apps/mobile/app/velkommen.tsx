import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LOFTE, UNDERTITTEL } from '@skodd/core';
import { Skjerm } from '../src/komponenter/Skjerm.tsx';
import { Text } from '../src/komponenter/Text.tsx';
import { Knapp } from '../src/komponenter/Knapp.tsx';
import { Merke, Dekkprofil } from '../src/komponenter/Merke.tsx';
import { aksentNa, farge, spor, t } from '../src/tema.ts';

export default function Velkommen() {
  const router = useRouter();
  const aksent = aksentNa();

  return (
    <Skjerm
      rull={false}
      style={{ flex: 1, justifyContent: 'space-between', paddingBottom: spor.xl }}
      bunn={
        <>
          <Knapp tittel="Se prisen for bilen din" aksent={aksent} onPress={() => router.push('/start/regnr')} />
          <Knapp tittel="Jeg har konto" variant="tekst" onPress={() => router.push('/logg-inn/telefon')} />
        </>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: spor.lg, paddingVertical: spor.xxl }}>
        <Merke storrelse={40} aksent={aksent} />
        <View style={{ gap: spor.sm }}>
          <Text style={t.h1}>{LOFTE}</Text>
          <Text style={[t.brodDempet, { maxWidth: 320 }]}>{UNDERTITTEL}</Text>
        </View>

        <View style={{ gap: spor.sm, marginTop: spor.md }}>
          {[
            'Begge sett, lagring og to skift i året',
            'Vi kommer dit bilen står',
            'Nye dekk når mønsteret er brukt opp',
            'Én fast månedspris, ingen sjokkregninger',
          ].map((linje) => (
            <View key={linje} style={{ flexDirection: 'row', alignItems: 'center', gap: spor.sm }}>
              <Dekkprofil bredde={10} hoyde={18} farge={aksent} tett={3} />
              <Text style={[t.brod, { flex: 1, color: farge.tekst }]}>{linje}</Text>
            </View>
          ))}
        </View>
      </View>
    </Skjerm>
  );
}
