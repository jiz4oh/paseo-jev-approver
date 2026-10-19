import { useTranslation } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

type Key = keyof typeof en;
const catalogs: Record<string, Partial<Record<Key, string>>> = { en, "zh-CN": zhCN };
export function translate(locale: string, key: Key): string {
  const normalized = locale.toLowerCase().replace("_", "-");
  const lang = normalized === "zh" || normalized.startsWith("zh-cn") || normalized.startsWith("zh-sg") || normalized.startsWith("zh-hans") ? "zh-CN" : "en";
  return catalogs[lang]?.[key] ?? en[key];
}
/** Follow Paseo's active I18nextProvider, not the OS/browser language. */
export function usePluginT() {
  const { i18n } = useTranslation();
  return (key: Key) => translate(i18n.resolvedLanguage ?? i18n.language ?? "en", key);
}
