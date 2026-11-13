/**
 * Montørens inntasting av mønster: pluss og minus i steg på 0,1 mm, store
 * trykkflater, fordi dette skjer med hansker i en kald garasje.
 */
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { farge, radius, skrift, spor, t } from '../tema.ts';

export function Mmvelger({ etikett, verdi, settVerdi, aksent }: {
  etikett: string; verdi: number; settVerdi: (n: number) => void; aksent: string;
}) {
  const juster = (delta: number) => {
    settVerdi(Math.round(Math.min(12, Math.max(0, verdi + delta)) * 10) / 10);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spor.sm }}>
      <Text style={[t.etikett, { width: 56 }]}>{etikett}</Text>
      <Trykk tegn="–" onPress={() => juster(-0.1)} etikett={`Mindre ${etikett}`} />
      <View style={{ flex: 1, alignItems: 'center', minWidth: 64 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: skrift.overskrift, fontSize: 24, color: farge.tekst }}
        >
          {verdi.toFixed(1).replace('.', ',')}
        </Text>
      </View>
      <Trykk tegn="+" onPress={() => juster(0.1)} etikett={`Mer ${etikett}`} aksent={aksent} />
    </View>
  );
}

function Trykk({ tegn, onPress, etikett, aksent }: {
  tegn: string; onPress: () => void; etikett: string; aksent?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etikett}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 52, height: 48, borderRadius: radius.sm,
        backgroundColor: pressed ? farge.kant : farge.bakgrunn,
        borderWidth: 1, borderColor: aksent ?? farge.kant,
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <Text style={{ fontSize: 22, color: aksent ?? farge.tekst, lineHeight: 26 }}>{tegn}</Text>
    </Pressable>
  );
}
