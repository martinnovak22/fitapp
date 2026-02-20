const expoConfig = require('eslint-config-expo/flat')
const { defineConfig } = require('eslint/config')

module.exports = defineConfig([
    expoConfig,
    {
        ignores: [
            'node_modules/**',
            'android/**',
            'ios/**',
            '.expo/**',
            'dist/**',
            'build-*.aab',
            'build-*.apks',
            '*.apk',
        ],
    },
    {
        files: ['scripts/**/*.ts'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
])
