import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { AuthTilbyder } from '../src/auth.tsx';
import { PameldingTilbyder } from '../src/pamelding.tsx';
import { aksentNa, farge } from '../src/tema.ts';

export default function Rotoppsett() {
  const [fonterKlare] = useFonts({
    SpaceGrotesk_500Medium, SpaceGrotesk_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  if (!fonterKlare) {
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
