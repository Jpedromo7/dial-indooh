import { useEffect, useState } from "react";
import { AppState, BackHandler, Platform } from "react-native";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { ActivationScreen } from "./src/screens/ActivationScreen";
import { LoadingScreen } from "./src/screens/LoadingScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { clearDeviceSession, getDeviceSession } from "./src/storage/deviceStorage";
import type { DeviceSession } from "./src/types/signage";

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<DeviceSession | null>(null);

  useEffect(() => {
    void activateKeepAwakeAsync();

    if (Platform.OS === "android") {
      void hideAndroidSystemUi();
    }

    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && Platform.OS === "android") {
        void hideAndroidSystemUi();
      }
    });

    getDeviceSession()
      .then(setSession)
      .finally(() => setIsBooting(false));

    return () => {
      appStateSubscription.remove();
      backSubscription.remove();
    };
  }, []);

  if (isBooting) {
    return (
      <>
        <StatusBar hidden />
        <LoadingScreen />
      </>
    );
  }

  const handleSessionExpired = async () => {
    await clearDeviceSession();
    setSession(null);
  };

  return (
    <>
      <StatusBar hidden />
      {session ? (
        <PlayerScreen onSessionExpired={handleSessionExpired} session={session} />
      ) : (
        <ActivationScreen onActivated={setSession} />
      )}
    </>
  );
}

async function hideAndroidSystemUi() {
  await NavigationBar.setVisibilityAsync("hidden");
  await NavigationBar.setBehaviorAsync("overlay-swipe");
}
