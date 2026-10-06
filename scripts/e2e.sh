#!/usr/bin/env bash
# Runs the Maestro suite in .maestro/ against an Android emulator.
#
#   yarn e2e            run the suite on the installed build
#   yarn e2e --build    build a release APK first and install it
#   yarn e2e --repeat 5 run the suite five times in a row (flakiness check)
#
# The flows start from a cleared app state, so this only ever targets an
# emulator: it refuses to run against a physical device. Pick one with
# E2E_DEVICE=emulator-5556 when several are running.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_ID=com.martinnovak22.fitapp
APK=android/app/build/outputs/apk/release/app-release.apk
build=false
repeat=1

while [ $# -gt 0 ]; do
    case "$1" in
        --build) build=true ;;
        --repeat)
            repeat="$2"
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 2
            ;;
    esac
    shift
done

device="${E2E_DEVICE:-$(adb devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')}"
if [ -z "$device" ]; then
    echo "No running Android emulator found. Start one (e.g. Pixel_9a) and retry." >&2
    exit 1
fi
if [[ "$device" != emulator-* ]]; then
    echo "Refusing to run on $device: the suite clears app data, so it runs on emulators only." >&2
    exit 1
fi

if $build; then
    if [ ! -d android ]; then
        npx expo prebuild --platform android
    fi
    # A local test build: no Sentry events and no source-map upload.
    (cd android && EXPO_PUBLIC_SENTRY_DSN='' SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease -q)
    # Uninstall first: an in-place update needs room for two copies of the APK.
    adb -s "$device" uninstall "$APP_ID" >/dev/null 2>&1 || true
    adb -s "$device" install "$APK"
fi

for run in $(seq 1 "$repeat"); do
    if [ "$repeat" -gt 1 ]; then
        echo "=== Run $run of $repeat ==="
    fi
    maestro --device "$device" test .maestro
done
