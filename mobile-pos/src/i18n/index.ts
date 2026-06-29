import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { mmkvGetString, mmkvSetString } from "../storage/mmkv";
import en from "./en.json";
import fr from "./fr.json";
import rw from "./rw.json";

const LANG_KEY = "app_language";

export type AppLanguage = "en" | "fr" | "rw";

export function getSavedLanguage(): string | null {
  return mmkvGetString(LANG_KEY);
}

export function setAppLanguage(lang: AppLanguage): void {
  mmkvSetString(LANG_KEY, lang);
  void i18n.changeLanguage(lang);
}

function detectLanguage(): AppLanguage {
  const saved = getSavedLanguage();
  if (saved === "en" || saved === "fr" || saved === "rw") return saved;
  const device = Localization.getLocales()[0]?.languageCode ?? "en";
  if (device.startsWith("fr")) return "fr";
  if (device.startsWith("rw")) return "rw";
  return "en";
}

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    rw: { translation: rw },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
