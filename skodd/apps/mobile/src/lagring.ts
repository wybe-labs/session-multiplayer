/** Token lagres i nøkkelringen på enheten, og i localStorage på web. */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NOKKEL = 'skodd.token';

export async function lagreToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(NOKKEL, token); } catch { /* lagring er blokkert */ }
    return;
  }
  await SecureStore.setItemAsync(NOKKEL, token);
}

export async function hentToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return globalThis.localStorage?.getItem(NOKKEL) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(NOKKEL);
}

export async function slettToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.removeItem(NOKKEL); } catch { /* lagring er blokkert */ }
    return;
  }
  await SecureStore.deleteItemAsync(NOKKEL);
}
