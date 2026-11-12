/** Tekst med Inter som standard, slik at ingen skjerm faller tilbake til systemfonten. */
import { Text as RNText, type TextProps } from 'react-native';
import { skrift, farge } from '../tema.ts';

export function Text({ style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: skrift.brodtekst, color: farge.tekst }, style]}
    />
  );
}
