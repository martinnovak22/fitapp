import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SupabaseAuthSessionData,
  getSupabaseSessionFromOAuthRedirectUrl,
  refreshSupabaseSession,
  signInWithEmailPassword,
  signOutSupabaseSession,
  signUpWithEmailPassword,
} from '@/src/data/remote/supabase/auth';
import { clearSupabaseSession, setSupabaseSession } from '@/src/data/remote/supabase/session';
import { isRemoteDataMode } from '@/src/modules/auth/authMode';

type AuthContextValue = {
  isAuthRequired: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithOAuthRedirectUrl: (url: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = 'supabase-auth-session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const shouldRefresh = (session: SupabaseAuthSessionData): boolean => {
  const refreshBufferMs = 60 * 1000;
  return session.expiresAt - Date.now() <= refreshBufferMs;
};

const applySession = (session: SupabaseAuthSessionData) => {
  setSupabaseSession({
    accessToken: session.accessToken,
    userId: session.userId,
  });
};

const persistSession = async (session: SupabaseAuthSessionData) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const loadStoredSession = async (): Promise<SupabaseAuthSessionData | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SupabaseAuthSessionData;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [session, setSession] = useState<SupabaseAuthSessionData | null>(null);
  const isAuthRequired = isRemoteDataMode();

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!isAuthRequired) {
        if (isMounted) {
          clearSupabaseSession();
          setSession(null);
          setIsInitialized(true);
        }
        return;
      }

      try {
        const stored = await loadStoredSession();
        if (!stored) {
          clearSupabaseSession();
          if (isMounted) setSession(null);
          return;
        }

        const activeSession = shouldRefresh(stored) ? await refreshSupabaseSession(stored.refreshToken) : stored;
        applySession(activeSession);
        await persistSession(activeSession);
        if (isMounted) setSession(activeSession);
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        clearSupabaseSession();
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) setIsInitialized(true);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [isAuthRequired]);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInWithEmailPassword(email.trim(), password);
    applySession(nextSession);
    await persistSession(nextSession);
    setSession(nextSession);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const nextSession = await signUpWithEmailPassword(email.trim(), password);
    applySession(nextSession);
    await persistSession(nextSession);
    setSession(nextSession);
  }, []);

  const signInWithOAuthRedirectUrl = useCallback(async (url: string) => {
    const nextSession = await getSupabaseSessionFromOAuthRedirectUrl(url);
    if (!nextSession) return false;
    applySession(nextSession);
    await persistSession(nextSession);
    setSession(nextSession);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    if (session?.accessToken) {
      try {
        await signOutSupabaseSession(session.accessToken);
      } catch {
        // Local sign-out should still complete even when network logout fails.
      }
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    clearSupabaseSession();
    setSession(null);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthRequired,
      isInitialized,
      isAuthenticated: !isAuthRequired || session !== null,
      userEmail: session?.email ?? null,
      signIn,
      signUp,
      signInWithOAuthRedirectUrl,
      signOut,
    }),
    [isAuthRequired, isInitialized, session, signIn, signInWithOAuthRedirectUrl, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
