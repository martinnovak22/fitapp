// Learn more https://docs.expo.dev/guides/customizing-metro
// Wrapped with Sentry's Metro config so source maps line up with stack traces.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

module.exports = config
