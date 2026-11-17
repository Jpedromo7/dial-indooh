const { withGradleProperties } = require("@expo/config-plugins");

/**
 * APK só para TV boxes (todas são ARM): tira as bibliotecas x86/x86_64 de emulador.
 * APK menor = download mais rápido na atualização remota e menos espaço na box.
 */
function withTvBoxBuild(config) {
  return withGradleProperties(config, (gradleConfig) => {
    setProperty(gradleConfig.modResults, "reactNativeArchitectures", "armeabi-v7a,arm64-v8a");
    return gradleConfig;
  });
}

function setProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === "property" && item.key === key);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: "property", key, value });
  }
}

module.exports = withTvBoxBuild;
