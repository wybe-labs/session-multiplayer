/**
 * Mønsterdybden som en ring. Viser hvor mye av settets levetid som er brukt,
 * med tallet i millimeter i midten. Dette er appens viktigste tall.
 */
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './Text.tsx';
import { farge, skrift, t } from '../tema.ts';

export function Monsterring({ mm, brukt, aksent, storrelse = 180 }: {
  mm: number; brukt: number; aksent: string; storrelse?: number;
}) {
  const tykkelse = 14;
  const r = (storrelse - tykkelse) / 2;
  const omkrets = 2 * Math.PI * r;
  const igjen = Math.max(0, Math.min(1, 1 - brukt));
  const strek = omkrets * igjen;

  return (
    <View style={{ width: storrelse, height: storrelse, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={storrelse} height={storrelse} style={{ position: 'absolute' }}>
        <Circle
          cx={storrelse / 2} cy={storrelse / 2} r={r}
          stroke={farge.kant} strokeWidth={tykkelse} fill="none"
        />
        <Circle
          cx={storrelse / 2} cy={storrelse / 2} r={r}
          stroke={aksent} strokeWidth={tykkelse} fill="none"
          strokeDasharray={`${strek} ${omkrets}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${storrelse / 2} ${storrelse / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: skrift.overskrift, fontSize: storrelse * 0.26, color: farge.tekst, letterSpacing: -2 }}>
          {mm.toFixed(1).replace('.', ',')}
        </Text>
        <Text style={t.etikett}>mm igjen</Text>
      </View>
    </View>
  );
}
