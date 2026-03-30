const dataMode = (process.env.EXPO_PUBLIC_DATA_MODE || "remote").toLowerCase()

module.exports = {
    expo: {
        name: "FitApp",
        slug: "fitapp",
        version: "0.3.1",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "fitapp",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        splash: {
            image: "./assets/images/splash.png",
            resizeMode: "contain",
            backgroundColor: "#607d8b"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.martinnovak22.fitapp"
        },
        android: {
            edgeToEdgeEnabled: true,
            package: "com.martinnovak22.fitapp",
            versionCode: 31
        },
        web: {
            bundler: "metro",
            output: "static",
            favicon: "./assets/images/favicon.png"
        },
        plugins: ["expo-router", "expo-sqlite"],
        experiments: {
            typedRoutes: true
        },
        extra: {
            dataMode,
            router: {},
            eas: {
                projectId: "66cc05d1-9eb9-457a-b100-f0fa864d965f"
            }
        }
    }
}
