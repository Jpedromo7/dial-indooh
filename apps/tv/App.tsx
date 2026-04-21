import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { ActivationScreen } from "./src/screens/ActivationScreen";
import { LoadingScreen } from "./src/screens/LoadingScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { getDeviceSession } from "./src/storage/deviceStorage";
import type { DeviceSession } from "./src/types/signage";

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<DeviceSession | null>(null);

  useEffect(() => {
    void activateKeepAwakeAsync();

    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden");
      void NavigationBar.setBehaviorAsync("overlay-swipe");
    }

    getDeviceSession()
      .then(setSession)
      .finally(() => setIsBooting(false));
  }, []);

  if (isBooting) {
    return (
      <>
        <StatusBar hidden />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar hidden />
      {session ? <PlayerScreen session={session} /> : <ActivationScreen onActivated={setSession} />}
    </>
  );
}
