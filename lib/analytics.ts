import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

const DEVICE_UUID_KEY = 'device_uuid';

async function getDeviceUuid(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_UUID_KEY);
    if (stored) return stored;
    const fresh = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_UUID_KEY, fresh);
    return fresh;
  } catch {
    return Crypto.randomUUID();
  }
}

export function logEvent(event_type: string, metadata: Record<string, unknown> = {}): void {
  getDeviceUuid()
    .then((device_uuid) =>
      supabase.from('app_events').insert({ device_uuid, event_type, metadata }),
    )
    .catch((err) => console.error('[analytics]', err));
}
