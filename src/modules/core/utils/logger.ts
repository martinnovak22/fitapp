type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function log(level: LogLevel, operation: string, error?: unknown) {
    if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error ?? '')
        const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
        fn(`[${level.toUpperCase()}] [${operation}]${message ? ` ${message}` : ''}`, error ?? '')
    }
}
