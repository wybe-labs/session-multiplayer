import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { Text } from './Text.tsx';
import { farge, spor, t } from '../tema.ts';

/** Felles ramme: asfaltbakgrunn, trygge marger og 16 px luft i kantene. */
export function Skjerm({ tittel, undertittel, children, style, bunn, rull = true }: {
  tittel?: string; undertittel?: string; children: ReactNode;
  style?: StyleProp<ViewStyle>; bunn?: ReactNode; rull?: boolean;
}) {
  const kant = useSafeAreaInsets();
  const innhold = (
    <View style={[{ padding: spor.md, gap: spor.md }, style]}>
      {tittel ? (
        <View style={{ gap: spor.xs, paddingTop: spor.sm, paddingBottom: spor.xs }}>
          <Text style={t.h1}>{tittel}</Text>
          {undertittel ? <Text style={t.brodDempet}>{undertittel}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: farge.bakgrunn, paddingTop: kant.top }}>
      {rull ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spor.xxl + kant.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          {innhold}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{innhold}</View>
      )}
      {bunn ? (
        <View
          style={{
            padding: spor.md,
            paddingBottom: spor.md + kant.bottom,
            borderTopWidth: 1,
            borderTopColor: farge.kant,
            backgroundColor: farge.bakgrunn,
            gap: spor.sm,
          }}
        >
          {bunn}
        </View>
      ) : null}
    </View>
  );
}
