// Stub for @sentry/react-native used under Vitest.
//
// The real package pulls in react-native (Flow-typed index.js), which rolldown
// cannot parse in the node test environment. Any test that transitively imports
// the logger would fail at parse time. This no-op stub stands in for it; it
// matches the runtime surface the logger touches (withScope/setTag/setLevel/
// captureException/captureMessage). Types are erased at runtime, so the
// SeverityLevel type used in logger.ts needs no runtime counterpart here.
//
// Aliased in vitest.config.ts; never bundled into the app.

type Scope = {
    setTag: (key: string, value: string) => void
    setLevel: (level: string) => void
}

export function withScope(callback: (scope: Scope) => void): void {
    callback({ setTag: () => {}, setLevel: () => {} })
}

export function captureException(_error: unknown): void {}

export function captureMessage(_message: string): void {}
