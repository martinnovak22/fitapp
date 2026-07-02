const { withSentry } = require('@sentry/react-native/expo')

const config = {
    expo: {
        name: 'FitApp',
        slug: 'fitapp',
        version: '0.6.0',
        orientation: 'portrait',
        icon: './assets/images/icon.png',
        scheme: 'fitapp',
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        splash: {
            image: './assets/images/splash.png',
            resizeMode: 'contain',
            backgroundColor: '#607d8b',
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: 'com.martinnovak22.fitapp',
        },
        android: {
            edgeToEdgeEnabled: true,
            package: 'com.martinnovak22.fitapp',
            versionCode: 60,
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/images/favicon.png',
        },
        plugins: ['expo-router', 'expo-sqlite', '@react-native-community/datetimepicker'],
        experiments: {
            typedRoutes: true,
        },
        extra: {
            router: {},
            eas: {
                projectId: '66cc05d1-9eb9-457a-b100-f0fa864d965f',
            },
        },
    },
}

// withSentry adds the build-time hook that uploads source maps so production
// crash reports show readable stack traces. Org/project come from the
// environment (see .env / EAS secrets); SENTRY_AUTH_TOKEN is read automatically.
module.exports = withSentry(config, {
    // EU region — your DSN points at ingest.de.sentry.io, so source-map upload
    // must use the matching regional endpoint.
    url: 'https://de.sentry.io/',
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
})
