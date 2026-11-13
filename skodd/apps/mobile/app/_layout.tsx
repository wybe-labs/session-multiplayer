import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { AuthTilbyder } from '../src/auth.tsx';
import { ER_DEMO } from '../src/api.ts';
import { PameldingTilbyder } from '../src/pamelding.tsx';
import { aksentNa, farge } from '../src/tema.ts';

export default function Rotoppsett() {
  // I demobygget er fontene lagt inn i selve siden, så det er ingenting å laste.
  const [lastet, feilet] = useFonts(ER_DEMO ? {} : {
    SpaceGrotesk_500Medium, SpaceGrotesk_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  // En font som ikke lar seg laste skal gi systemfont, ikke en evig spinner.
  if (!lastet && !feilet) {
    return (
      <View style={{ flex: 1, backgroundColor: farge.bakgrunn, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={aksentNa()} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthTilbyder>
        <PameldingTilbyder>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: farge.bakgrunn },
              animation: 'slide_from_right',
            }}
          />
        </PameldingTilbyder>
      </AuthTilbyder>
    </SafeAreaProvider>
  );
}
