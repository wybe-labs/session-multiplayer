import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth.tsx';
import { aksentNa, farge } from '../src/tema.ts';

/** Første skjerm avgjør bare hvor brukeren skal. */
export default function Start() {
  const { klar, bruker } = useAuth();

  if (!klar) {
    return (
      <View style={{ flex: 1, backgroundColor: farge.bakgrunn, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={aksentNa()} />
      </View>
    );
  }

  if (!bruker) return <Redirect href="/velkommen" />;
  if (bruker.rolle === 'montor') return <Redirect href="/montor/dagen" />;
  return <Redirect href="/kunde/hjem" />;
}
