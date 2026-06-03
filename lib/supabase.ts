import 'react-native-get-random-values';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';

class WebStorage {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    await AsyncStorage.setItem(
      key,
      aesjs.utils.hex.fromBytes(encryptedBytes),
    );
  }

  private async _decrypt(key: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const encryptionKey = aesjs.utils.hex.toBytes(encryptionKeyHex);
    const encryptedBytes = aesjs.utils.hex.toBytes(encrypted);

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(encryptedBytes);

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await this._decrypt(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this._encrypt(key, value);
    } catch {
      // If encryption fails, remove stale keys
      await this.removeItem(key);
    }
  }

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: Platform.OS === 'web' ? new WebStorage() : new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
