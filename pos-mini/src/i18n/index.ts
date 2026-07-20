import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { getAppLanguage } from '../repositories/metaRepository';
import en from './en.json';
import fr from './fr.json';

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  const saved = await getAppLanguage();
  const deviceLang = Localization.getLocales()[0]?.languageCode;
  const lng = saved || (deviceLang === 'fr' ? 'fr' : 'en');

  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  initialized = true;
}

export async function changeAppLanguage(lang: 'en' | 'fr'): Promise<void> {
  const { saveAppLanguage } = await import('../repositories/metaRepository');
  await saveAppLanguage(lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
