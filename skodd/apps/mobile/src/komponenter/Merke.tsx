/**
 * Ordmerket. Skrevet med små bokstaver i tung vekt, der de to d-ene er
 * tegnet som dekkprofiler side om side: sommersettet og vintersettet.
 * Favikonet er de samme to d-ene.
 */
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Text } from './Text.tsx';
import { farge, skrift } from '../tema.ts';

/** Et lite mønsterfelt. Brukes som punktmerke i lister. */
export function Dekkprofil({ bredde = 14, hoyde = 26, farge: f = farge.tekst, tett = 4 }: {
  bredde?: number; hoyde?: number; farge?: string; tett?: number;
}) {
  const sporBredde = bredde / (tett * 2 - 1);
  return (
    <Svg width={bredde} height={hoyde}>
      {Array.from({ length: tett }, (_, i) => (
        <Rect key={i} x={i * sporBredde * 2} y={0} width={sporBredde} height={hoyde} rx={sporBredde / 2} fill={f} />
      ))}
    </Svg>
  );
}

/**
 * En d der skålen er dekkets veibane, med tre spor skåret ut.
 * Formen er bygget av stammen og skålen, så den leses som en bokstav.
 */
export function DekkD({ hoyde = 34, farge: f = farge.tekst, bak = farge.bakgrunn }: {
  hoyde?: number; farge?: string; bak?: string;
}) {
  const h = 140;
  const b = 92;
  const skala = hoyde / h;
  return (
    <Svg width={b * skala} height={hoyde} viewBox={`0 0 ${b} ${h}`}>
      {/* Stammen i d-en */}
      <Rect x={72} y={0} width={18} height={h} rx={5} fill={f} />
      {/* Skålen ligger på x-høyden, som i en vanlig d */}
      <Rect x={0} y={64} width={90} height={76} rx={38} fill={f} />
      {/* Tre spor skåret ut, slik et dekkmønster ser ut. De gjør også
          jobben til hullet i bokstaven. */}
      {[16, 38, 60].map((x) => (
        <Rect key={x} x={x} y={74} width={9} height={56} rx={4.5} fill={bak} />
      ))}
    </Svg>
  );
}

export function Merke({ storrelse = 28, aksent, bak }: {
  storrelse?: number; aksent?: string; bak?: string;
}) {
  const bakgrunn = bak ?? farge.bakgrunn;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text
        style={{
          fontFamily: skrift.overskrift,
          fontSize: storrelse,
          lineHeight: storrelse * 1.02,
          color: farge.tekst,
          letterSpacing: -storrelse * 0.03,
        }}
      >
        sko
      </Text>
      <View style={{ flexDirection: 'row', gap: storrelse * 0.06, paddingBottom: storrelse * 0.015 }}>
        <DekkD hoyde={storrelse} farge={farge.tekst} bak={bakgrunn} />
        <DekkD hoyde={storrelse} farge={aksent ?? farge.is} bak={bakgrunn} />
      </View>
    </View>
  );
}
