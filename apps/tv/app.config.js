module.exports = {
  expo: {
    name: "Dial Indooh TV",
    slug: "dial-indooh-tv",
    version: "0.1.0",
    orientation: "landscape",
    userInterfaceStyle: "dark",
    android: {
      package: "com.dialindooh.tv",
      softwareKeyboardLayoutMode: "pan",
      permissions: ["INTERNET", "WAKE_LOCK", "ACCESS_NETWORK_STATE"],
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
      heartbeatMinutes: Number(process.env.EXPO_PUBLIC_HEARTBEAT_MINUTES ?? 2)
    }
  }
};
