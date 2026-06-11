import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionPersistence } from '@omadia/canvas-core';

const SERVER_URL_KEY = 'omadia.serverUrl';
const SESSION_ID_KEY = 'omadia.canvasSessionId';

export interface AppSettings {
  serverUrl: string;
}

export const SettingsStorage = {
  async load(): Promise<AppSettings | null> {
    try {
      const serverUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
      return serverUrl ? { serverUrl } : null;
    } catch (error) {
      console.warn('Failed to load app settings', error);
      return null;
    }
  },

  async save(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(SERVER_URL_KEY, settings.serverUrl);
    } catch (error) {
      console.warn('Failed to save app settings', error);
    }
  },
};

export class AsyncSessionPersistence implements SessionPersistence {
  private cache: string | undefined;

  async hydrate(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_ID_KEY);
      this.cache = stored ?? undefined;
    } catch (error) {
      console.warn('Failed to hydrate canvas session', error);
      this.cache = undefined;
    }
  }

  load(): string | undefined {
    return this.cache;
  }

  save(id: string): void {
    this.cache = id;
    void AsyncStorage.setItem(SESSION_ID_KEY, id).catch((error: unknown) => {
      console.warn('Failed to persist canvas session', error);
    });
  }
}
