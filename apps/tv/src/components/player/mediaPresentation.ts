import type { MediaOrientation, MediaRotation } from "@dialindooh/shared";
import type { ImageStyle } from "react-native";

interface MediaBounds {
  width: number;
  height: number;
}

export function inferAutoRotationDegrees(
  orientation: MediaOrientation,
  sourceSize: MediaBounds | null | undefined
): MediaRotation {
  if (!sourceSize?.width || !sourceSize?.height) {
    return 0;
  }

  if (orientation !== "portrait" && orientation !== "landscape") {
    return 0;
  }

  const sourceOrientation = getOrientationFromDimensions(sourceSize.width, sourceSize.height);

  if (!sourceOrientation || sourceOrientation === "square") {
    return 0;
  }

  return sourceOrientation !== orientation ? 90 : 0;
}

export function getPresentedMediaStyle(bounds: MediaBounds | null, rotationDegrees: MediaRotation): ImageStyle {
  if (!bounds) {
    return rotationDegrees === 0
      ? { height: "100%", width: "100%" }
      : { height: "100%", width: "100%", transform: [{ rotate: `${rotationDegrees}deg` }] };
  }

  if (rotationDegrees === 90 || rotationDegrees === 270) {
    return {
      height: bounds.width,
      transform: [{ rotate: `${rotationDegrees}deg` }],
      width: bounds.height
    };
  }

  return {
    height: bounds.height,
    transform: rotationDegrees === 180 ? [{ rotate: "180deg" }] : undefined,
    width: bounds.width
  };
}

function getOrientationFromDimensions(width: number, height: number) {
  const ratio = width / height;

  if (ratio > 1.1) {
    return "landscape";
  }

  if (ratio < 0.9) {
    return "portrait";
  }

  return "square";
}
