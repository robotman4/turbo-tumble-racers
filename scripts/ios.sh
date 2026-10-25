#!/usr/bin/env bash
# iOS builds on the Mac (Xcode needed). See docs/IOS.md for setup and troubleshooting.
#   scripts/ios.sh check     tools and settings this needs
#   scripts/ios.sh sim       build and run in the iOS Simulator (no Apple account needed)
#   scripts/ios.sh device    build and install on a connected iPhone/iPad      (needs TEAM_ID)
#   scripts/ios.sh release   archive and upload to App Store Connect           (needs TEAM_ID)
# Settings come from the environment, never from files in the repo:
#   TEAM_ID        Apple Developer team id (10 characters, developer.apple.com -> Membership)
#   DEVICE         device id for `device` (default: the first connected device)
#   VERSION        marketing version (default: "version" in package.json)
#   BUILD_NUMBER   build number, must grow for every upload (default: date and time)
#   ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID   optional App Store Connect API key for `release`;
#                  without it Xcode uses the Apple ID signed in under Xcode -> Settings -> Accounts
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=ios/App/App.xcodeproj
SCHEME=App
BUNDLE_ID=$(node -p "require('./capacitor.config.json').appId")
OUT=build/ios
VERSION=${VERSION:-$(node -p "require('./package.json').version")}
BUILD_NUMBER=${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}

need_team() {
  if [ -z "${TEAM_ID:-}" ]; then
    echo "TEAM_ID is not set. Find it at developer.apple.com -> Account -> Membership, then: TEAM_ID=XXXXXXXXXX $0 $1" >&2
    exit 1
  fi
}

web() {
  [ -d node_modules ] || npm ci
  npm run build:native
}

auth_args() {
  if [ -n "${ASC_KEY_PATH:-}" ]; then
    echo "-authenticationKeyPath $ASC_KEY_PATH -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID"
  fi
}

case "${1:-}" in
  check)
    xcodebuild -version
    echo "node $(node -v)"
    echo "bundle id: $BUNDLE_ID   version: $VERSION"
    echo "TEAM_ID: ${TEAM_ID:-not set (only needed for device and release)}"
    xcrun simctl list devices available | grep -E "iPad|iPhone" | head -n 5
    xcrun devicectl list devices 2>/dev/null | head -n 10 || true
    ;;
  sim)
    web
    SIM=$(xcrun simctl list devices available -j | node -e '
      const d = JSON.parse(require("fs").readFileSync(0, "utf8")).devices;
      const all = Object.values(d).flat().filter((x) => x.isAvailable);
      const pick = all.find((x) => /iPad/.test(x.name)) || all.find((x) => /iPhone/.test(x.name));
      if (!pick) process.exit(1); console.log(pick.udid);')
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug -sdk iphonesimulator \
      -destination "id=$SIM" -derivedDataPath "$OUT/derived" CODE_SIGNING_ALLOWED=NO build
    APP=$(find "$OUT/derived/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name "*.app" | head -n 1)
    xcrun simctl boot "$SIM" 2>/dev/null || true
    open -a Simulator
    xcrun simctl install "$SIM" "$APP"
    xcrun simctl launch "$SIM" "$BUNDLE_ID"
    ;;
  device)
    need_team device
    web
    mkdir -p "$OUT"
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug -destination 'generic/platform=iOS' \
      -derivedDataPath "$OUT/derived" -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM_ID" \
      CODE_SIGN_STYLE=Automatic build
    APP=$(find "$OUT/derived/Build/Products/Debug-iphoneos" -maxdepth 1 -name "*.app" | head -n 1)
    if [ -z "${DEVICE:-}" ]; then
      xcrun devicectl list devices --json-output "$OUT/devices.json" >/dev/null 2>&1 || true
      DEVICE=$(node -e '
        try {
          const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices;
          const c = d.find((x) => x.connectionProperties && x.connectionProperties.tunnelState === "connected") || d[0];
          if (c) console.log(c.identifier);
        } catch (e) {}' "$OUT/devices.json")
    fi
    DEV=${DEVICE:-}
    if [ -z "$DEV" ]; then echo "No connected device. Plug in the iPad/iPhone, unlock it and trust this Mac." >&2; exit 1; fi
    xcrun devicectl device install app --device "$DEV" "$APP"
    xcrun devicectl device process launch --device "$DEV" "$BUNDLE_ID" || true
    ;;
  release)
    need_team release
    web
    rm -rf "$OUT/App.xcarchive" "$OUT/export"
    # shellcheck disable=SC2046
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release -destination 'generic/platform=iOS' \
      -archivePath "$OUT/App.xcarchive" -allowProvisioningUpdates $(auth_args) \
      DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic \
      MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" archive
    cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST
    # shellcheck disable=SC2046
    xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
      -exportPath "$OUT/export" -allowProvisioningUpdates $(auth_args)
    echo "Uploaded version $VERSION ($BUILD_NUMBER). It appears in App Store Connect -> TestFlight after processing (10-30 min)."
    ;;
  *)
    sed -n '2,15p' "$0"; exit 1 ;;
esac
