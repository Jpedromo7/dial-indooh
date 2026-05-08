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
      <View style={styles.panel}>
        <BrandLogo size={76} />
        <Text style={styles.title}>Ativar esta tela</Text>
        <Text style={styles.copy}>Digite o código de ativação criado no painel.</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isLoading}
          maxLength={16}
          onChangeText={(value) => setActivationCode(value.toUpperCase())}
          onSubmitEditing={handleActivation}
          placeholder="DEMO01"
          placeholderTextColor="#586174"
          returnKeyType="done"
          style={styles.input}
          value={activationCode}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          focusable
          onBlur={() => setButtonFocused(false)}
          onFocus={() => setButtonFocused(true)}
          onPress={handleActivation}
          style={[styles.button, buttonFocused && styles.buttonFocused, isLoading && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isLoading ? "Ativando..." : "Ativar"}</Text>
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
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center",
    padding: 40
  },
  panel: {
    alignItems: "center",
    backgroundColor: "#10141f",
    borderColor: "#2b3548",
    borderRadius: 8,
    borderWidth: 1,
    gap: 18,
    maxWidth: 620,
    paddingHorizontal: 56,
    paddingVertical: 42,
    width: "100%"
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800"
  },
  copy: {
    color: "#a8b3c7",
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center"
  },
  input: {
    backgroundColor: "#070a10",
    borderColor: "#39465f",
    borderRadius: 6,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800",
    height: 72,
    letterSpacing: 0,
    paddingHorizontal: 20,
    textAlign: "center",
    width: "100%"
  },
  error: {
    color: "#fb7185",
    fontSize: 16,
    textAlign: "center"
  },
  button: {
    alignItems: "center",
    backgroundColor: "#22c7aa",
    borderRadius: 6,
    minWidth: 220,
    paddingHorizontal: 28,
    paddingVertical: 16
  },
  buttonFocused: {
    borderColor: "#ffffff",
    borderWidth: 2
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonText: {
    color: "#001411",
    fontSize: 20,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#39465f",
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 260,
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
  }
});
