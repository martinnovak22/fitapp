export type SupabaseConfig = {
    url: string
    publicKey: string
    emailRedirectTo?: string
}

export const getSupabaseConfig = (): SupabaseConfig | null => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL
    const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const legacyAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    const emailRedirectTo = process.env.EXPO_PUBLIC_SUPABASE_EMAIL_REDIRECT_TO
    const publicKey = publishableKey ?? legacyAnonKey

    if (!url || !publicKey) return null
    return { url, publicKey, emailRedirectTo }
}
