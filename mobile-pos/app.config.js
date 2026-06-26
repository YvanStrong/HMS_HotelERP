/**
 * Dynamic Expo config — cleartext HTTP and EAS projectId vary by build profile.
 *
 * Local Expo Go / dev: set EXPO_PUBLIC_ALLOW_CLEARTEXT=true in .env (LAN HTTP backend).
 * EAS production: usesCleartextTraffic=false (HTTPS only).
 *
 * Push: run `eas init` once, then EAS_PROJECT_ID is injected at build time.
 * For local dev builds, set EXPO_PUBLIC_EAS_PROJECT_ID in .env.
 */
const base = require("./app.json");

const PLACEHOLDER_RE = /REPLACE/i;

function resolveProjectId() {
  const candidates = [
    process.env.EAS_PROJECT_ID,
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    base.expo?.extra?.eas?.projectId,
  ];
  for (const id of candidates) {
    if (id && typeof id === "string" && !PLACEHOLDER_RE.test(id)) {
      return id.trim();
    }
  }
  return undefined;
}

function allowCleartextTraffic() {
  if (process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "true") return true;
  if (process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "false") return false;
  const profile = process.env.EAS_BUILD_PROFILE ?? "";
  // Dev client + internal LAN staging APKs may use HTTP; store builds must not.
  return profile === "development" || profile === "preview" || profile === "staging";
}

function withBuildProperties(plugins, usesCleartext) {
  let replaced = false;
  const next = (plugins ?? []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-build-properties") {
      replaced = true;
      return [
        "expo-build-properties",
        {
          ...(plugin[1] ?? {}),
          android: {
            ...(plugin[1]?.android ?? {}),
            usesCleartextTraffic: usesCleartext,
          },
        },
      ];
    }
    return plugin;
  });
  if (!replaced) {
    next.push([
      "expo-build-properties",
      { android: { usesCleartextTraffic: usesCleartext } },
    ]);
  }
  return next;
}

/** @param {{ config: import('@expo/config-types').ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const usesCleartext = allowCleartextTraffic();
  const projectId = resolveProjectId();
  const profile = process.env.EAS_BUILD_PROFILE ?? "local";

  return {
    ...config,
    plugins: withBuildProperties(config.plugins ?? base.expo.plugins, usesCleartext),
    extra: {
      ...(config.extra ?? {}),
      ...(base.expo.extra ?? {}),
      buildProfile: profile,
      allowCleartext: usesCleartext,
      eas: {
        ...(base.expo.extra?.eas ?? {}),
        ...(config.extra?.eas ?? {}),
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
