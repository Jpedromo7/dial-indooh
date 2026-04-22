module.exports = {
  expo: {
    name: "Dial Indooh TV",
    slug: "dial-indooh-tv",
    version: "0.1.5",
    icon: "./assets/dial-indooh-logo.png",
    orientation: "landscape",
    userInterfaceStyle: "dark",
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/e8208178-4e9d-47c7-9de4-bb05472b81a4",
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },
    splash: {
      image: "./assets/dial-indooh-logo.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    plugins: ["./plugins/withAndroidKioskMode"],
    android: {
      package: "com.dialindooh.tv",
      versionCode: 8,
      adaptiveIcon: {
        foregroundImage: "./assets/dial-indooh-logo.png",
        backgroundColor: "#000000"
      },
      softwareKeyboardLayoutMode: "pan",
      permissions: ["INTERNET", "WAKE_LOCK", "ACCESS_NETWORK_STATE"],
      intentFilters: [
        {
          action: "MAIN",
          category: ["LEANBACK_LAUNCHER", "LAUNCHER"]
        },
        {
          action: "MAIN",
          category: ["HOME", "DEFAULT"]
        }
      ]
    },
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
      playlistRefreshMinutes: Number(process.env.EXPO_PUBLIC_PLAYLIST_REFRESH_MINUTES ?? 5),
      heartbeatMinutes: Number(process.env.EXPO_PUBLIC_HEARTBEAT_MINUTES ?? 2),
      eas: {
        projectId: "e8208178-4e9d-47c7-9de4-bb05472b81a4"
      }
    }
  }
};
