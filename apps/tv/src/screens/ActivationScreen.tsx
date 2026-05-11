import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { activateScreen } from "../services/apiClient";
import { openOverlayPermissionSettings } from "../services/systemSettings";
import { saveDeviceSession } from "../storage/deviceStorage";
import type { DeviceSession } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface ActivationScreenProps {
  onActivated: (session: DeviceSession) => void;
}

export function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const [activationCode, setActivationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  const [settingsButtonFocused, setSettingsButtonFocused] = useState(false);

  async function handleActivation() {
    if (!activationCode.trim()) {
      setError("Digite o código de ativação exibido no painel.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await activateScreen(activationCode.trim().toUpperCase());
      const session = {
        screenId: response.screenId,
        deviceKey: response.deviceKey,
        activatedAt: new Date().toISOString()
      };
      await saveDeviceSession(session);
      onActivated(session);
    } catch (activationError) {
      setError(getErrorMessage(activationError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenOverlaySettings() {
    try {
      await openOverlayPermissionSettings();
    } catch (settingsError) {
      setError(getErrorMessage(settingsError));
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.accentBand} />
      <View style={styles.layout}>
        <View style={styles.hero}>
          <BrandLogo size={116} />
          <Text style={styles.brand}>Dial indoor TV</Text>
          <Text style={styles.heroCopy}>Reprodutor pronto para assumir a tela e manter sua playlist em execução.</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusPill}>Modo kiosk</Text>
            <Text style={styles.statusPill}>Android TV</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Ativação</Text>
          <Text style={styles.title}>Conectar esta tela</Text>
          <Text style={styles.copy}>Digite o código gerado no painel em Telas.</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading}
            maxLength={16}
            onChangeText={(value) => setActivationCode(value.toUpperCase())}
            onSubmitEditing={handleActivation}
            placeholder="DEMO01"
            placeholderTextColor="#5f6f84"
            returnKeyType="done"
            style={styles.input}
            value={activationCode}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              focusable
              onBlur={() => setButtonFocused(false)}
              onFocus={() => setButtonFocused(true)}
              onPress={handleActivation}
              style={[styles.button, buttonFocused && styles.buttonFocused, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{isLoading ? "Ativando..." : "Ativar tela"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              focusable
              onBlur={() => setSettingsButtonFocused(false)}
              onFocus={() => setSettingsButtonFocused(true)}
              onPress={handleOpenOverlaySettings}
              style={[styles.secondaryButton, settingsButtonFocused && styles.secondaryButtonFocused]}
            >
              <Text style={styles.secondaryButtonText}>Permitir sobreposição</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accentBand: {
    backgroundColor: "#22c7aa",
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 8
  },
  actions: {
    flexDirection: "row",
    gap: 14
  },
  brand: {
    color: "#f8fafc",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0
  },
  button: {
    alignItems: "center",
    backgroundColor: "#22c7aa",
    borderRadius: 6,
    minWidth: 210,
    paddingHorizontal: 28,
    paddingVertical: 16
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonFocused: {
    borderColor: "#ffffff",
    borderWidth: 2
  },
  buttonText: {
    color: "#001411",
    fontSize: 20,
    fontWeight: "900"
  },
  copy: {
    color: "#a8b3c7",
    fontSize: 18,
    lineHeight: 26
  },
  error: {
    color: "#fb7185",
    fontSize: 16
  },
  eyebrow: {
    color: "#22c7aa",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  hero: {
    flex: 1,
    gap: 20,
    justifyContent: "center",
    maxWidth: 520
  },
  heroCopy: {
    color: "#a8b3c7",
    fontSize: 22,
    lineHeight: 32
  },
  input: {
    backgroundColor: "#070a10",
    borderColor: "#39465f",
    borderRadius: 6,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 42,
    fontWeight: "900",
    height: 78,
    letterSpacing: 0,
    paddingHorizontal: 22,
    textAlign: "center",
    width: "100%"
  },
  layout: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 48,
    paddingHorizontal: 64,
    paddingVertical: 48,
    width: "100%"
  },
  panel: {
    backgroundColor: "#0c1320",
    borderColor: "#2b3548",
    borderRadius: 8,
    borderWidth: 1,
    gap: 18,
    maxWidth: 640,
    paddingHorizontal: 42,
    paddingVertical: 38,
    width: "48%"
  },
  screen: {
    alignItems: "center",
    backgroundColor: "#060910",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#39465f",
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 250,
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  secondaryButtonFocused: {
    borderColor: "#22c7aa",
    borderWidth: 2
  },
  secondaryButtonText: {
    color: "#dbe5f5",
    fontSize: 17,
    fontWeight: "700"
  },
  statusPill: {
    borderColor: "#25475d",
    borderRadius: 999,
    borderWidth: 1,
    color: "#c7d2e5",
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  statusRow: {
    flexDirection: "row",
    gap: 10
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0
  }
});
