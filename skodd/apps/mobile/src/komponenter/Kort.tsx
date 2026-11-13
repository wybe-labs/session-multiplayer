import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text.tsx';
import { farge, radius, spor, t } from '../tema.ts';
import type { ReactNode } from 'react';

export function Kort({ tittel, children, style, hoyre }: {
  tittel?: string; children: ReactNode; style?: StyleProp<ViewStyle>; hoyre?: ReactNode;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: farge.flate,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: farge.kant,
          padding: spor.md,
          gap: spor.sm,
        },
        style,
      ]}
    >
      {tittel ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={t.etikett}>{tittel}</Text>
          {hoyre}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Rad({ venstre, hoyre, dempet }: { venstre: string; hoyre: string; dempet?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spor.md }}>
      <Text style={[t.brod, dempet && { color: farge.dempet }, { flexShrink: 1 }]}>{venstre}</Text>
      <Text style={[t.brod, { textAlign: 'right' }]}>{hoyre}</Text>
    </View>
  );
}

export function Skille() {
  return <View style={{ height: 1, backgroundColor: farge.kant, marginVertical: spor.xs }} />;
}
