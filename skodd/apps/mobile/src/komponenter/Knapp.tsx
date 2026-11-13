import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text.tsx';
import { farge, radius, skrift, spor } from '../tema.ts';

export interface KnappProps {
  tittel: string;
  onPress: () => void;
  variant?: 'primar' | 'sekundar' | 'tekst' | 'fare';
  aksent?: string;
  laster?: boolean;
  av?: boolean;
  style?: StyleProp<ViewStyle>;
  undertekst?: string;
}

export function Knapp({
  tittel, onPress, variant = 'primar', aksent, laster, av, style, undertekst,
}: KnappProps) {
  const akt = aksent ?? farge.is;
  const inaktiv = av || laster;

  const bakgrunn =
    variant === 'primar' ? akt : variant === 'fare' ? 'transparent' : variant === 'sekundar' ? farge.flate : 'transparent';
  const tekstfarge =
    variant === 'primar' ? farge.bakgrunn : variant === 'fare' ? farge.varsel : farge.tekst;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inaktiv, busy: !!laster }}
      onPress={inaktiv ? () => {} : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bakgrunn,
          borderRadius: radius.md,
          paddingVertical: variant === 'tekst' ? spor.sm : 16,
          paddingHorizontal: variant === 'tekst' ? 0 : spor.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inaktiv ? 0.45 : pressed ? 0.8 : 1,
          borderWidth: variant === 'sekundar' || variant === 'fare' ? 1 : 0,
          borderColor: variant === 'fare' ? farge.varsel : farge.kant,
          minHeight: variant === 'tekst' ? 36 : 52,
        },
        style,
      ]}
    >
      {laster ? (
        <ActivityIndicator color={tekstfarge} />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: skrift.brodtekstHalvfet, fontSize: 16, color: tekstfarge }}>
            {tittel}
          </Text>
          {undertekst ? (
            <Text style={{ fontSize: 12, color: tekstfarge, opacity: 0.7, marginTop: 2 }}>
              {undertekst}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
