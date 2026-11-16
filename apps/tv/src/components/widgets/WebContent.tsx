import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { UrlConfig, YoutubeConfig } from "@dialindooh/shared";
import { API_BASE_URL } from "../../config/appConfig";
import type { TvItem } from "../../types/signage";

/** YouTube (player oficial embutido) e páginas externas. Exigem internet. */
export function WebContent({ item, muted, onError }: { item: TvItem; muted: boolean; onError: () => void }) {
  const origin = useMemo(() => API_BASE_URL.replace(/\/api$/, ""), []);

  if (item.type === "youtube") {
    const videoId = (item.config as YoutubeConfig | null)?.videoId;
    if (!videoId) return <View style={styles.fill} />;

    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head>
      <body><iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${encodeURIComponent(videoId)}&origin=${encodeURIComponent(origin)}"
      allow="autoplay; encrypted-media" allowfullscreen></iframe></body></html>`;

    return (
      <WebView
        allowsInlineMediaPlayback
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onError={onError}
        originWhitelist={["*"]}
        source={{ html, baseUrl: origin }}
        style={styles.fill}
      />
    );
  }

  const url = (item.config as UrlConfig | null)?.url;
  if (!url) return <View style={styles.fill} />;

  return (
    <WebView
      allowsInlineMediaPlayback
      cacheEnabled={!(item.config as UrlConfig | null)?.reload}
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      onError={onError}
      onHttpError={onError}
      setSupportMultipleWindows={false}
      source={{ uri: url }}
      style={styles.fill}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: "#000000",
    flex: 1
  }
});
