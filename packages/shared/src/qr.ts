import type { QrCodeConfig } from "./index";

/** Texto codificado no QR Code conforme o tipo (link, WhatsApp, Instagram, Wi-Fi ou texto). */
export function qrText(config: QrCodeConfig) {
  const value = config.value.trim();

  switch (config.kind) {
    case "whatsapp": {
      const digits = value.replace(/\D/g, "");
      return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
    }
    case "instagram":
      return `https://instagram.com/${value.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`;
    case "wifi": {
      const escape = (text: string) => text.replace(/([\\;,:"])/g, "\\$1");
      return `WIFI:T:${config.wifiPassword ? "WPA" : "nopass"};S:${escape(value)};P:${escape(config.wifiPassword ?? "")};;`;
    }
    default:
      return value;
  }
}
