import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text.tsx';
import { farge, radius, skrift, spor, t } from '../tema.ts';

export interface FeltProps extends TextInputProps {
  etikett?: string;
  feil?: string | null;
  hjelp?: string;
  stor?: boolean;
}

export function Felt({ etikett, feil, hjelp, stor, style, ...rest }: FeltProps) {
  return (
    <View style={{ gap: spor.xs }}>
      {etikett ? <Text style={t.etikett}>{etikett}</Text> : null}
      <TextInput
        placeholderTextColor={farge.grus}
        {...rest}
        style={[
          {
            backgroundColor: farge.flate,
            borderWidth: 1,
            borderColor: feil ? farge.varsel : farge.kant,
            borderRadius: radius.md,
            paddingHorizontal: spor.md,
            paddingVertical: stor ? 18 : 14,
            color: farge.tekst,
            fontFamily: stor ? skrift.overskrift : skrift.brodtekst,
            fontSize: stor ? 28 : 16,
            letterSpacing: stor ? 2 : 0,
          },
          style,
        ]}
      />
      {feil ? <Text style={[t.liten, { color: farge.varsel }]}>{feil}</Text> : null}
      {!feil && hjelp ? <Text style={t.liten}>{hjelp}</Text> : null}
    </View>
  );
}
