# Android TV APK build

This project uses EAS Build to create an installable APK for Android TV boxes.

## Backend URL

The TV app is configured in `apps/tv/.env` to call:

```env
EXPO_PUBLIC_API_BASE_URL="https://dial-indooh.vercel.app/api"
```

Use the public HTTPS URL of the deployed admin/backend. Do not build the production APK with `localhost` or a private LAN IP.

## Build APK

```bash
cd apps/tv
npm run eas:login
npm run build:apk
```

When the build finishes, EAS prints a download URL for the `.apk`.

## Install and activate

1. Install the downloaded APK on the Android TV box.
2. Open `Dial Indooh TV`.
3. Enter the activation code shown in the admin panel.

The seed screen uses:

```txt
DEMO01
```

After activation, the app stores the device key locally and opens the fullscreen player.
