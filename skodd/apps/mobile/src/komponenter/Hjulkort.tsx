/**
 * De fire hjulene med målt mønster. Tre punkter per dekk, slik montøren
 * måler dem, så skjev slitasje er synlig for kunden også.
 */
import { View } from 'react-native';
import type { HjulMaling, Hjulposisjon, Sesong } from '@skodd/core';
import { HJULNAVN, LOVLIG_MIN_MM, NYTT_MM, SKODD_GRENSE_MM } from '@skodd/core';
import { Text } from './Text.tsx';
import { farge, radius, skrift, spor, t } from '../tema.ts';

function Stolpe({ mm, sesong, aksent }: { mm: number; sesong: Sesong; aksent: string }) {
  const andel = Math.max(0.04, Math.min(1, mm / NYTT_MM[sesong]));
  const f = mm < LOVLIG_MIN_MM[sesong] ? farge.varsel : mm < SKODD_GRENSE_MM[sesong] ? farge.sol : aksent;
  return (
    <View style={{ flex: 1, height: 56, justifyContent: 'flex-end', backgroundColor: farge.bakgrunn, borderRadius: 4 }}>
      <View style={{ height: `${andel * 100}%`, backgroundColor: f, borderRadius: 4 }} />
    </View>
  );
}

export function Hjulkort({ hjul, sesong, aksent }: { hjul: HjulMaling; sesong: Sesong; aksent: string }) {
  const min = Math.min(hjul.innerMm, hjul.midtMm, hjul.ytterMm);
  const spenn = Math.max(hjul.innerMm, hjul.midtMm, hjul.ytterMm) - min;
  return (
    <View
      style={{
        flex: 1, minWidth: 150, backgroundColor: farge.flate, borderRadius: radius.md,
        borderWidth: 1, borderColor: farge.kant, padding: spor.sm, gap: spor.xs,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={t.etikett}>{hjul.posisjon}</Text>
        <Text style={{ fontFamily: skrift.overskrift, fontSize: 20, color: farge.tekst }}>
          {min.toFixed(1).replace('.', ',')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Stolpe mm={hjul.innerMm} sesong={sesong} aksent={aksent} />
        <Stolpe mm={hjul.midtMm} sesong={sesong} aksent={aksent} />
        <Stolpe mm={hjul.ytterMm} sesong={sesong} aksent={aksent} />
      </View>
      <Text style={t.liten}>{HJULNAVN[hjul.posisjon as Hjulposisjon]}</Text>
      {spenn >= 1.5 ? (
        <Text style={[t.liten, { color: farge.sol }]}>
          {spenn.toFixed(1).replace('.', ',')} mm skjevt
        </Text>
      ) : null}
    </View>
  );
}
