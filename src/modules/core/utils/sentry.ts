import * as Sentry from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'

// Navigation instrumentation for Expo Router. Registered against the router's
// navigation container ref in the root layout (see app/_layout.tsx).
export const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
})

/**
 * Initialise Sentry. Called once at module load before the app renders.
 *
 * Reporting is enabled whenever a DSN is present, so it works in dev (to verify
 * the integration) and in release builds. If `EXPO_PUBLIC_SENTRY_DSN` is unset,
 * the SDK no-ops and the app behaves exactly as before.
 */
export function initSentry() {
    Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
        // Performance tracing: full sampling in dev, a fraction in production to
        // stay within the free-tier quota.
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        enableNativeFramesTracking: !isRunningInExpoGo(),
        integrations: [navigationIntegration],
    })
}

/**
 * Associate (or clear) the current user on Sentry events so a crash report
 * shows which user hit it. Pass null to scrub the user on sign-out.
 */
export function setSentryUser(user: { id: string; email?: string | null } | null) {
    Sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null)
}
