# Android TV Kiosk Mode

The TV app is prepared for a lightweight kiosk setup:

- opens as a normal Android TV app
- can be selected as the default Home app
- receives boot/package-replaced events and relaunches itself
- hides the Android navigation bar
- blocks the Back button inside React Native

## Recommended TV Box Setup

1. Install the latest Dial Indooh TV APK.
2. Open it once and activate the screen.
3. Press the remote Home button.
4. When Android asks which Home app to use, choose **Dial Indooh TV** and select **Always**.
5. If the device has a vendor setting like **Auto start**, **Boot app**, **Background start**, or **Battery optimization**, allow Dial Indooh TV.
6. Reboot the TV box and confirm the player opens by itself.

## Notes

This setup is intentionally called lightweight kiosk mode because standard Android does not allow an app to silently take over the whole device.

For a fully locked device where users cannot leave the player, use one of these approaches:

- Android Device Owner / Lock Task provisioning
- an MDM platform
- a TV box firmware setting that forces a default launcher or boot app

The current implementation is the most practical path for low-cost Android TV boxes: set Dial Indooh TV as the default Home app and let the boot receiver reopen the player after restarts.
