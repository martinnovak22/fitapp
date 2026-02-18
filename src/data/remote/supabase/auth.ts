import { SupabaseConfig, getSupabaseConfig } from '@/src/data/remote/supabase/config';

export type SupabaseAuthSessionData = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
  expiresAt: number;
};

export const EMAIL_CONFIRMATION_REQUIRED_CODE = 'email_confirmation_required';

export class SupabaseAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.code = code;
  }
}

type SupabaseAuthApiResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string | null;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

type AuthRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
};

const parseErrorMessage = (payload: SupabaseAuthApiResponse | null, fallback: string) => {
  if (!payload) return fallback;
  return payload.error_description ?? payload.msg ?? payload.error ?? fallback;
};

const authRequest = async <T>(
  config: SupabaseConfig,
  endpoint: string,
  options?: AuthRequestOptions,
): Promise<T> => {
  const response = await fetch(`${config.url}/auth/v1/${endpoint}`, {
    method: options?.method ?? 'POST',
    headers: {
      apikey: config.publicKey,
      Authorization: `Bearer ${options?.accessToken ?? config.publicKey}`,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);
  if (!response.ok) {
    const errorPayload = (payload as SupabaseAuthApiResponse | null) ?? null;
    throw new Error(parseErrorMessage(errorPayload, 'Authentication request failed.'));
  }

  return payload;
};

const normalizeSession = (payload: SupabaseAuthApiResponse): SupabaseAuthSessionData => {
  if (!payload.access_token || !payload.refresh_token || !payload.user?.id || !payload.expires_in) {
    throw new Error('Authentication did not return a valid session.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    userId: payload.user.id,
    email: payload.user.email ?? null,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
};

const requireConfig = (): SupabaseConfig => {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  return config;
};

export const signInWithEmailPassword = async (email: string, password: string): Promise<SupabaseAuthSessionData> => {
  const config = requireConfig();
  const payload = await authRequest<SupabaseAuthApiResponse>(config, 'token?grant_type=password', {
    body: { email, password },
  });
  return normalizeSession(payload);
};

export const signUpWithEmailPassword = async (email: string, password: string): Promise<SupabaseAuthSessionData> => {
  const config = requireConfig();
  const body: Record<string, unknown> = { email, password };
  if (config.emailRedirectTo) {
    body.email_redirect_to = config.emailRedirectTo;
  }

  const payload = await authRequest<SupabaseAuthApiResponse>(config, 'signup', {
    body,
  });

  if (!payload.access_token) {
    throw new SupabaseAuthError(
      EMAIL_CONFIRMATION_REQUIRED_CODE,
      'Sign-up succeeded, but email confirmation is required before login.',
    );
  }

  return normalizeSession(payload);
};

export const refreshSupabaseSession = async (refreshToken: string): Promise<SupabaseAuthSessionData> => {
  const config = requireConfig();
  const payload = await authRequest<SupabaseAuthApiResponse>(config, 'token?grant_type=refresh_token', {
    body: { refresh_token: refreshToken },
  });
  return normalizeSession(payload);
};

export const signOutSupabaseSession = async (accessToken: string): Promise<void> => {
  const config = getSupabaseConfig();
  if (!config) return;

  await authRequest<unknown>(config, 'logout', {
    accessToken,
  });
};
