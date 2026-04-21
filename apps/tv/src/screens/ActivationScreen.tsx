import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { activateScreen } from "../services/apiClient";
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

  async function handleActivation() {
    if (!activationCode.trim()) {
      setError("Enter the activation code shown in the admin panel.");
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

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>D</Text>
        </View>
        <Text style={styles.title}>Activate this screen</Text>
        <Text style={styles.copy}>Enter the activation code created in the admin panel.</Text>
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
          <Text style={styles.buttonText}>{isLoading ? "Activating..." : "Activate"}</Text>
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
  logo: {
    alignItems: "center",
    backgroundColor: "#22c7aa",
    borderRadius: 8,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  logoText: {
    color: "#001411",
    fontSize: 34,
    fontWeight: "900"
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
  }
});
