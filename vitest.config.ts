import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest picked over Jest: faster TS+ESM startup, no Expo/RN runtime needed for
// pure data-layer tests, and no babel/jest preset gymnastics.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
        },
    },
    test: {
        include: ['src/**/__tests__/**/*.test.ts'],
        environment: 'node',
        testTimeout: 5000,
        hookTimeout: 5000,
    },
})
