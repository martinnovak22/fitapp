import { configureRepositories, getLocalRepositories, resetRepositories } from '@/src/data/repositories';
import { DataMode, RemoteDataProvider } from '@/src/data/remote/provider';
import { createSupabaseProvider } from '@/src/data/remote/supabase/provider';

let remoteProvider: RemoteDataProvider | null = null;
let initialized = false;

const getDataMode = (): DataMode => {
  const mode = process.env.EXPO_PUBLIC_DATA_MODE?.toLowerCase();
  if (mode === 'remote') return 'remote';
  return 'local';
};

export const registerRemoteProvider = (provider: RemoteDataProvider) => {
  remoteProvider = provider;
};

export const initializeDataLayer = () => {
  if (initialized) return;

  if (!remoteProvider) {
    const supabaseProvider = createSupabaseProvider();
    if (supabaseProvider) {
      remoteProvider = supabaseProvider;
    }
  }

  const mode = getDataMode();
  if (mode === 'remote') {
    if (!remoteProvider) {
      console.warn('[data] EXPO_PUBLIC_DATA_MODE=remote, but no remote provider registered. Falling back to local repositories.');
      resetRepositories();
      initialized = true;
      return;
    }
    configureRepositories(remoteProvider);
    initialized = true;
    return;
  }

  configureRepositories(getLocalRepositories());
  initialized = true;
};
