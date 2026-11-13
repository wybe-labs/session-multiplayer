import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth.tsx';
import { aksentNa, farge, skrift } from '../../src/tema.ts';
import { DekkIkon, HusIkon, KalenderIkon, PersonIkon } from '../../src/komponenter/Ikoner.tsx';

export default function Kundeoppsett() {
  const { klar, bruker } = useAuth();
  const aksent = aksentNa();

  if (!klar) return null;
  if (!bruker) return <Redirect href="/velkommen" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: aksent,
        tabBarInactiveTintColor: farge.grus,
        tabBarStyle: {
          backgroundColor: farge.bakgrunn,
          borderTopColor: farge.kant,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: skrift.brodtekstMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: farge.bakgrunn },
      }}
    >
      <Tabs.Screen
        name="hjem"
        options={{ title: 'Hjem', tabBarIcon: ({ color }) => <HusIkon farge={String(color)} /> }}
      />
      <Tabs.Screen
        name="dekk"
        options={{ title: 'Dekkene', tabBarIcon: ({ color }) => <DekkIkon farge={String(color)} /> }}
      />
      <Tabs.Screen
        name="skift"
        options={{ title: 'Skift', tabBarIcon: ({ color }) => <KalenderIkon farge={String(color)} /> }}
      />
      <Tabs.Screen
        name="meg"
        options={{ title: 'Meg', tabBarIcon: ({ color }) => <PersonIkon farge={String(color)} /> }}
      />
      <Tabs.Screen name="skade" options={{ href: null }} />
    </Tabs>
  );
}
