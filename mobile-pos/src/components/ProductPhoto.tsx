import { useState } from "react";
import { Image as RNImage, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { imageCachePolicy, resolveMediaUrl } from "../lib/mediaUrl";

const PHOTO_HEIGHT = 128;

const styles = StyleSheet.create({
  placeholder: {
    width: "100%",
    height: PHOTO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  image: {
    width: "100%",
    height: PHOTO_HEIGHT,
    backgroundColor: "#f1f5f9",
  },
});

type Props = {
  photoUrl?: string | null;
  contentFit?: "cover" | "contain";
  height?: number;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ProductPhoto({
  photoUrl,
  contentFit = "cover",
  height = PHOTO_HEIGHT,
  imageStyle,
}: Props) {
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaUrl(photoUrl);
  const imageStyles = [styles.image, { height }, imageStyle];
  const resizeMode = contentFit === "contain" ? "contain" : "cover";

  if (!uri) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Ionicons name="fast-food-outline" size={32} color="#64748b" />
      </View>
    );
  }

  if (failed || uri.startsWith("data:")) {
    return (
      <RNImage
        source={{ uri }}
        style={imageStyles}
        resizeMode={resizeMode}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={imageStyles}
      contentFit={contentFit}
      cachePolicy={imageCachePolicy(uri)}
      transition={200}
      onError={() => setFailed(true)}
    />
  );
}
