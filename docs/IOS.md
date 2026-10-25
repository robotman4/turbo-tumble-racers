# iOS builds (on the Mac)

How to build the iPhone/iPad app, put it on a device and upload it to the App Store.
It's written for the owner and for a Claude Code session running on the owner's Mac,
which can do all of it with `scripts/ios.sh`.

The game code is the same as the web version. `npm run build:native` builds it for the app
(no service worker, no update button, save mirrored to native storage) and copies it into
`ios/` with Capacitor. The Xcode project is `ios/App/App.xcodeproj`. It uses Swift Package
Manager, so CocoaPods isn't needed.

## One-time setup (the owner does this)

1. Install **Xcode** from the Mac App Store, open it once and accept the license.
   Install Node 22 (`brew install node@22`, or from nodejs.org).
2. **Apple Developer Program** membership ($99/year) at developer.apple.com.
   Note the **Team ID** (Account → Membership, 10 characters).
3. In Xcode → Settings → Accounts, add the Apple ID that's in the developer team.
   This lets the builds create certificates and profiles automatically.
4. In **App Store Connect** → Apps → +, create the app with bundle id
   `io.github.robotman4.turbotumble` (see "Bundle id" below), name "Turbo Tumble Racers",
   primary language and SKU (anything, e.g. `turbotumble`).
5. Optional, for uploads without an Xcode login (useful for Claude Code sessions and CI):
   App Store Connect → Users and Access → Integrations → App Store Connect API → Generate key,
   role "App Manager". Keep the `.p8` file **outside the repo**, for example `~/.appstoreconnect/`.

## Commands

```bash
scripts/ios.sh check                         # Xcode, Node, simulators, connected devices
scripts/ios.sh sim                           # build and run in the iPad Simulator
TEAM_ID=XXXXXXXXXX scripts/ios.sh device     # install on the plugged-in iPad/iPhone
TEAM_ID=XXXXXXXXXX scripts/ios.sh release    # archive and upload to App Store Connect
```

`release` also reads `VERSION` (default: `version` in `package.json`) and `BUILD_NUMBER`
(default: date and time, so it always grows). With an API key, add
`ASC_KEY_PATH=~/.appstoreconnect/AuthKey_XXXX.p8 ASC_KEY_ID=XXXX ASC_ISSUER_ID=xxxxxxxx-...`.

Or by hand: `npm run ios` opens Xcode. Pick the team under App target → Signing & Capabilities,
choose the device and press Run. For the store: Product → Archive → Distribute App → App Store Connect.

After uploading, the build shows under TestFlight in App Store Connect after 10–30 minutes.
Install TestFlight on the iPad to try it, then submit it for review from App Store Connect.

## Rules for a Claude Code session doing this

- Start with `scripts/ios.sh check` and fix what it reports before anything else.
- Run `npm test` before any device or release build. Don't upload a build with failing tests.
- **Never commit** the Team ID, `.p8` keys, certificates, provisioning profiles or passwords.
  Pass them as environment variables. `build/` (archives, exports) is git-ignored.
- `sim` and `device` are safe to run any time. **Ask the owner before `release`**: it uploads
  to Apple under their account.
- To change the version for the store, edit `version` in `package.json` and merge that into
  `main` like any other change. The build number is automatic.
- Don't edit files under `ios/App/App/public` or the generated `capacitor.config.json` in `ios/`.
  They're overwritten by `npm run build:native`. Change the game in `src/` instead.
- If a native setting really must change (Info.plist, project settings), make the change in
  `ios/`, commit it, and say why in the commit message.

## Common problems

| Message | Fix |
| --- | --- |
| `No Accounts` / `No signing certificate "iOS Development" found` | Add the Apple ID in Xcode → Settings → Accounts (setup step 3), or pass the API key variables. |
| `No profiles for 'io.github.robotman4.turbotumble' were found` | The scripts pass `-allowProvisioningUpdates`; make sure `TEAM_ID` is right and the account is in that team. |
| `The app identifier ... cannot be registered` | The bundle id is taken or belongs to another team: change it (see below). |
| Device not found / `devicectl` errors | Unlock the device, tap "Trust this computer", and enable Developer Mode (Settings → Privacy & Security). |
| Upload rejected: build number already used | Run again (the default build number is the current time) or set `BUILD_NUMBER` higher. |
| `xcodebuild: error: SDK "iphonesimulator" cannot be located` | `sudo xcode-select -s /Applications/Xcode.app` |
| Blank white app | `npm run build:native` didn't run or failed; the web files are copied into `ios/App/App/public`. |

## Bundle id

`io.github.robotman4.turbotumble`, set in `capacitor.config.json`, the Xcode project
(PRODUCT_BUNDLE_IDENTIFIER) and `android/app/build.gradle`. It can't change after the first
App Store upload, so change it in all three places before that if you want a different one.

## Store listing notes

The game collects no data, has no ads, no accounts and no purchases. In App Store Connect:
App Privacy → "Data Not Collected", age rating 4+, and the Kids category (ages 5 and under,
or 6–8) if wanted. The Kids category requires exactly this: no third-party analytics or ads.
Screenshots can be taken in the Simulator (`scripts/ios.sh sim`, then File → Save Screen in the Simulator).
