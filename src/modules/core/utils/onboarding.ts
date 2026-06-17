import AsyncStorage from '@react-native-async-storage/async-storage'
import {
    fetchRemoteOnboardingCompleted,
    markRemoteOnboardingCompleted,
} from '@/src/data/remote/supabase/onboardingRemote'
import { getSupabaseSession } from '@/src/data/remote/supabase/session'
import { log } from '@/src/modules/core/utils/logger'

const ONBOARDING_KEY = 'onboarding_completed'

const readLocal = async (): Promise<boolean> => {
    try {
        return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true'
    } catch (error) {
        // A storage read failure must never strand the user — treat as "not done".
        log('warn', 'readOnboardingFlag', error)
        return false
    }
}

const writeLocal = async (): Promise<void> => {
    try {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    } catch (error) {
        log('warn', 'writeOnboardingFlag', error)
    }
}

/**
 * Whether onboarding has been completed.
 *
 * In account mode the flag lives on the user's profile (so it survives reinstall
 * and follows the account across devices); we cache a positive result locally so
 * an offline relaunch still skips onboarding. Guest / local-only sessions have no
 * account, so the device-local flag is authoritative.
 */
export const isOnboardingCompleted = async (): Promise<boolean> => {
    const session = getSupabaseSession()
    if (!session?.userId) return readLocal()

    try {
        const remote = await fetchRemoteOnboardingCompleted(session.userId)
        if (remote) await writeLocal()
        return remote
    } catch (error) {
        // Offline or transient failure: fall back to the cached local flag rather
        // than forcing a logged-in user back through onboarding.
        log('warn', 'fetchOnboardingFlag', error)
        return readLocal()
    }
}

/**
 * Marks onboarding complete. Writes the local cache first so navigation always
 * proceeds even if the network write fails, then best-effort persists to the
 * account profile. Never throws — a write failure must not trap the user.
 */
export const markOnboardingCompleted = async (): Promise<void> => {
    await writeLocal()

    const session = getSupabaseSession()
    if (!session?.userId) return

    // Fire-and-forget the network write so navigation off onboarding isn't gated
    // on a slow request; the local cache already reflects completion.
    void markRemoteOnboardingCompleted(session.userId).catch((error) => log('warn', 'markOnboardingFlag', error))
}
