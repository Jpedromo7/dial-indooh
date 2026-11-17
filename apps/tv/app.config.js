module.exports = {
  expo: {
    name: "D Player",
    slug: "dial-indooh-tv",
    version: "2.3.0",
    icon: "./assets/d-player-icon.png",
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
    plugins: [
      [
        // Splash D Player (API nativa do Android 12+, com fallback nos antigos): símbolo centralizado no azul-marinho.
        "expo-splash-screen",
        {
          image: "./assets/d-player-splash.png",
          imageWidth: 220,
          resizeMode: "contain",
          backgroundColor: "#050B1C"
        }
      ],
      "./plugins/withAndroidKioskMode",
      "./plugins/withTvBoxBuild",
      "@config-plugins/react-native-webrtc"
    ],
    android: {
      package: "com.dialindooh.tv",
      versionCode: 23,
      adaptiveIcon: {
        foregroundImage: "./assets/d-player-adaptive-foreground.png",
        monochromeImage: "./assets/d-player-monochrome.png",
        backgroundColor: "#050B1C"
      },
      softwareKeyboardLayoutMode: "pan",
      permissions: [
        "INTERNET",
        "WAKE_LOCK",
        "ACCESS_NETWORK_STATE",
        "SYSTEM_ALERT_WINDOW",
        "RECORD_AUDIO",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_MEDIA_PROJECTION"
      ],
      intentFilters: [
        {
          action: "MAIN",
          category: ["LEANBACK_LAUNCHER", "LAUNCHER"]
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
