import * as Sentry from '@sentry/react-native'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENTRY_LEVELS: Record<LogLevel, Sentry.SeverityLevel> = {
    debug: 'debug',
    info: 'info',
    warn: 'warning',
    error: 'error',
}

export function log(level: LogLevel, operation: string, error?: unknown) {
    if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error ?? '')
        const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
        fn(`[${level.toUpperCase()}] [${operation}]${message ? ` ${message}` : ''}`, error ?? '')
    }

    // Forward warnings and errors to Sentry. No-ops when Sentry is disabled
    // (no DSN), so this is safe in every environment.
    if (level === 'warn' || level === 'error') {
        Sentry.withScope(scope => {
            scope.setTag('operation', operation)
            scope.setLevel(SENTRY_LEVELS[level])
            if (error instanceof Error) {
                Sentry.captureException(error)
            } else {
                Sentry.captureMessage(`[${operation}] ${String(error ?? '')}`)
            }
        })
    }
}
