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

const outcomeKeys = ["active", "dry_run", "needs_setup", "degraded", "unknown", "approved", "rejected", "denied", "allowed", "blocked", "manual_review"] as const;
export function tOutcome(outcome: string, t: (key: Key) => string): string {
  if ((outcomeKeys as readonly string[]).includes(outcome)) return t(outcome as typeof outcomeKeys[number]);
  return outcome.replace(/_/g, " ");
}
