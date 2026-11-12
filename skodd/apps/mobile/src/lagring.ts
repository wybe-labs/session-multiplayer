/** Token lagres i nøkkelringen på enheten, og i localStorage på web. */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NOKKEL = 'skodd.token';

export async function lagreToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(NOKKEL, token);
    return;
  }
  await SecureStore.setItemAsync(NOKKEL, token);
}

export async function hentToken(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(NOKKEL) ?? null;
  return SecureStore.getItemAsync(NOKKEL);
}

export async function slettToken(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(NOKKEL);
    return;
  }
  await SecureStore.deleteItemAsync(NOKKEL);
}
