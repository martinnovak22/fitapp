export type SupabaseSession = {
  accessToken: string;
  userId: string;
};

let currentSession: SupabaseSession | null = null;

export const setSupabaseSession = (session: SupabaseSession) => {
  currentSession = session;
};

export const clearSupabaseSession = () => {
  currentSession = null;
};

export const getSupabaseSession = (): SupabaseSession | null => currentSession;
