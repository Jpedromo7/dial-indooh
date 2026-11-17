import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import * as Network from "expo-network";
import { BrandLogo } from "../components/BrandLogo";
import { brandColors } from "../theme/brand";
import { API_BASE_URL, APP_VERSION } from "../config/appConfig";
import { activateScreen } from "../services/apiClient";
import { pauseWatchdog } from "../services/maintenance";
import { openOverlayPermissionSettings } from "../services/systemSettings";
import { getCachedBranding, saveDeviceSession } from "../storage/deviceStorage";
import type { DeviceSession } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface ActivationScreenProps {
  onActivated: (session: DeviceSession) => void;
}

const PANEL_HOST = API_BASE_URL.replace(/^https?:\/\//, "").replace(/\/api$/, "");

export function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / 1920, height / 1080) * 1.5;
  const s = (value: number) => Math.round(value * scale);
  const [activationCode, setActivationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<"input" | "activate" | "overlay" | null>("input");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    getCachedBranding()
      .then((branding) => setLogoUrl(branding?.logoUrl ?? null))
      .catch(() => undefined);
    const check = () =>
      Network.getNetworkStateAsync()
        .then((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)))
        .catch(() => setOnline(null));
    void check();
    const timer = setInterval(check, 10_000);
    return () => clearInterval(timer);
  }, []);

  async function handleActivation() {
    const code = activationCode.replace(/[^A-Z0-9]/gi, "").toUpperCase();

    if (code.length < 4) {
      setError("Digite o código de ativação mostrado no painel.");
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await activateScreen(code);
      const session = { screenId: response.screenId, deviceKey: response.deviceKey, activatedAt: new Date().toISOString() };
      await saveDeviceSession(session);
      onActivated(session);
    } catch (activationError) {
      const message = getErrorMessage(activationError);
      setError(
        /não encontrado/i.test(message)
          ? "Código não encontrado. Confira o código no painel (ele só pode ser usado uma vez)."
          : /muitas tentativas/i.test(message)
            ? message
            : `Não foi possível ativar: ${message}`
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOverlaySettings() {
    try {
      await pauseWatchdog(15);
      await openOverlayPermissionSettings();
    } catch (settingsError) {
      setError(getErrorMessage(settingsError));
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.glowA, { height: s(700), width: s(700), borderRadius: s(350) }]} />
      <View style={[styles.glowB, { height: s(600), width: s(600), borderRadius: s(300) }]} />

      <View style={[styles.content, { gap: s(56), paddingHorizontal: s(80) }]}>
        <View style={[styles.left, { gap: s(28) }]}>
          {logoUrl ? (
            <Image resizeMode="contain" source={{ uri: logoUrl }} style={{ height: s(110), width: s(280) }} />
          ) : (
            <BrandLogo size={s(110)} />
          )}
          <Text style={[styles.title, { fontSize: s(54) }]}>Ativar esta TV</Text>
          <View style={{ gap: s(20) }}>
            <Step n={1} s={s} text={`No painel ${PANEL_HOST}, abra Terminais.`} />
            <Step n={2} s={s} text="Cadastre o terminal (ou abra um existente) e veja o código de ativação." />
            <Step n={3} s={s} text="Digite o código ao lado e confirme." />
          </View>
          <View style={[styles.statusRow, { gap: s(14) }]}>
            <Text style={[styles.pill, { fontSize: s(18), paddingHorizontal: s(16), paddingVertical: s(6), borderRadius: s(20) }, online === false && styles.pillOff]}>
              {online === false ? "● Sem internet" : online ? "● Internet conectada" : "● Verificando internet"}
            </Text>
            <Text style={[styles.pill, { fontSize: s(18), paddingHorizontal: s(16), paddingVertical: s(6), borderRadius: s(20) }]}>App {APP_VERSION}</Text>
          </View>
        </View>

        <View style={[styles.card, { borderRadius: s(28), padding: s(48), gap: s(24) }]}>
          <Text style={[styles.label, { fontSize: s(22) }]}>CÓDIGO DE ATIVAÇÃO</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            editable={!isLoading}
            maxLength={10}
            onBlur={() => setFocused(null)}
            onChangeText={(value) => {
              setActivationCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setError(null);
            }}
            onFocus={() => setFocused("input")}
            onSubmitEditing={handleActivation}
            placeholder="Ex.: K7M2PQ9X"
            placeholderTextColor={brandColors.textSubtle}
            ref={inputRef}
            returnKeyType="done"
            style={[
              styles.input,
              { borderRadius: s(18), fontSize: s(56), height: s(110), letterSpacing: s(10), paddingHorizontal: s(24) },
              focused === "input" && styles.focusedBorder
            ]}
            value={activationCode}
          />
          {error ? <Text style={[styles.error, { fontSize: s(22) }]}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            focusable
            onBlur={() => setFocused(null)}
            onFocus={() => setFocused("activate")}
            onPress={handleActivation}
            style={[styles.button, { borderRadius: s(18), height: s(84) }, focused === "activate" && styles.buttonFocused, isLoading && styles.disabled]}
          >
            <Text style={[styles.buttonText, { fontSize: s(30) }]}>{isLoading ? "Ativando..." : "Ativar TV"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            focusable
            onBlur={() => setFocused(null)}
            onFocus={() => setFocused("overlay")}
            onPress={handleOverlaySettings}
            style={[styles.secondary, { borderRadius: s(18), minHeight: s(72), paddingHorizontal: s(20) }, focused === "overlay" && styles.focusedBorder]}
          >
            <Text style={[styles.secondaryText, { fontSize: s(22) }]}>Liberar “Sobrepor outros apps”</Text>
            <Text style={[styles.secondaryHint, { fontSize: s(16) }]}>Necessário para o app abrir sozinho ao ligar a TV</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Step({ n, text, s }: { n: number; text: string; s: (value: number) => number }) {
  return (
    <View style={[styles.step, { gap: s(18) }]}>
      <View style={[styles.stepBadge, { borderRadius: s(24), height: s(48), width: s(48) }]}>
        <Text style={[styles.stepNumber, { fontSize: s(24) }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { fontSize: s(26), lineHeight: s(34) }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: brandColors.blue,
    borderColor: "transparent",
    borderWidth: 3,
    justifyContent: "center"
  },
  buttonFocused: {
    backgroundColor: brandColors.blueFocused,
    borderColor: brandColors.cyan,
    transform: [{ scale: 1.03 }]
  },
  buttonText: {
    color: brandColors.white,
    fontWeight: "800"
  },
  card: {
    backgroundColor: "rgba(13, 20, 36, 0.94)",
    borderColor: brandColors.border,
    borderWidth: 1,
    flex: 1,
    maxWidth: 760
  },
  content: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center"
  },
  disabled: {
    opacity: 0.6
  },
  error: {
    color: "#fca5a5",
    fontWeight: "600"
  },
  focusedBorder: {
    borderColor: brandColors.cyan,
    borderWidth: 3
  },
  glowA: {
    backgroundColor: "rgba(137, 24, 232, 0.12)",
    left: "-8%",
    position: "absolute",
    top: "-20%"
  },
  glowB: {
    backgroundColor: "rgba(0, 217, 236, 0.07)",
    bottom: "-25%",
    position: "absolute",
    right: "-5%"
  },
  input: {
    backgroundColor: brandColors.navy,
    borderColor: brandColors.border,
    borderWidth: 2,
    color: "#f8fafc",
    fontWeight: "900",
    textAlign: "center"
  },
  label: {
    color: "#94a3b8",
    fontWeight: "800",
    letterSpacing: 2
  },
  left: {
    flex: 1,
    maxWidth: 820
  },
  pill: {
    backgroundColor: "rgba(0, 217, 236, 0.12)",
    color: brandColors.cyan,
    fontWeight: "700",
    overflow: "hidden"
  },
  pillOff: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#fca5a5"
  },
  screen: {
    backgroundColor: brandColors.background,
    flex: 1,
    overflow: "hidden"
  },
  secondary: {
    alignItems: "center",
    borderColor: brandColors.border,
    borderWidth: 2,
    justifyContent: "center",
    paddingVertical: 10
  },
  secondaryHint: {
    color: "#64748b",
    marginTop: 2,
    textAlign: "center"
  },
  secondaryText: {
    color: "#e2e8f0",
    fontWeight: "700",
    textAlign: "center"
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  step: {
    alignItems: "center",
    flexDirection: "row"
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: brandColors.blue,
    justifyContent: "center"
  },
  stepNumber: {
    color: brandColors.white,
    fontWeight: "800"
  },
  stepText: {
    color: "#cbd5e1",
    flex: 1
  },
  title: {
    color: "#f8fafc",
    fontWeight: "900"
  }
});
