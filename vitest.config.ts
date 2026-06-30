import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Vitest picked over Jest: faster TS+ESM startup, no Expo/RN runtime needed for
// pure data-layer tests, and no babel/jest preset gymnastics.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
            // @sentry/react-native transitively imports react-native's Flow-typed
            // entry, which rolldown can't parse in the node env. Swap in a no-op
            // stub so logger-importing tests load. See src/test/sentry-stub.ts.
            '@sentry/react-native': path.resolve(__dirname, 'src/test/sentry-stub.ts'),
        },
    },
    test: {
        include: ['src/**/__tests__/**/*.test.ts'],
        environment: 'node',
        testTimeout: 5000,
        hookTimeout: 5000,
        coverage: {
            // v8 picked to match the runtime; fallow reads the lcov/json it
            // emits so CRAP scores reflect measured coverage, not estimates.
            provider: 'v8',
            reporter: ['text', 'json', 'json-summary', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/test/**'],
        },
    },
})
