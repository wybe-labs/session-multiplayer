import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth.tsx';
import { farge } from '../../src/tema.ts';

export default function Montoroppsett() {
  const { klar, bruker } = useAuth();
  if (!klar) return null;
  if (!bruker) return <Redirect href="/velkommen" />;
  if (bruker.rolle === 'kunde') return <Redirect href="/kunde/hjem" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: farge.bakgrunn },
      }}
    />
  );
}
