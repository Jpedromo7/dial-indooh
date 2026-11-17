import { useEffect, useState } from "react";
import { AppState, BackHandler, Platform } from "react-native";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ActivationScreen } from "./src/screens/ActivationScreen";
import { LoadingScreen } from "./src/screens/LoadingScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { clearDeviceSession, getCachedBranding, getDeviceSession } from "./src/storage/deviceStorage";
import type { DeviceSession } from "./src/types/signage";

// Splash D Player sai com fade suave quando a primeira tela aparece.
SplashScreen.setOptions({ duration: 400, fade: true });

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);

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

    getCachedBranding()
      .then((branding) => setSplashUrl(branding?.splashUrl ?? null))
      .catch(() => undefined);

    // Mostra a abertura por pelo menos 1,5 s para a marca aparecer ao ligar a TV.
    Promise.all([getDeviceSession(), new Promise((resolve) => setTimeout(resolve, 1500))])
      .then(([storedSession]) => setSession(storedSession))
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
        <LoadingScreen splashUrl={splashUrl} />
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
