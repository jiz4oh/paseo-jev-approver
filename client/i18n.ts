import { useEffect, useState } from "react";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

type Key = keyof typeof en;
const catalogs: Record<string, Partial<Record<Key, string>>> = { en, "zh-CN": zhCN };
export function translate(locale: string, key: Key): string {
  const normalized = locale.toLowerCase().replace("_", "-");
  const lang = normalized === "zh" || normalized.startsWith("zh-cn") || normalized.startsWith("zh-sg") || normalized.startsWith("zh-hans") ? "zh-CN" : "en";
  return catalogs[lang]?.[key] ?? en[key];
}
/** Use the document's active language where the host exposes it, with device fallback.
 * No dependency on host-private i18next modules (not included in the plugin bundle).
 */
function hostLocale(): string {
  if (typeof document !== "undefined") {
    const lang = document.documentElement?.lang;
    if (lang) return lang;
  }
  return typeof navigator !== "undefined" ? navigator.language : "en";
}
export function usePluginT() {
  const [locale, setLocale] = useState(hostLocale);
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setLocale(hostLocale()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return (key: Key) => translate(locale, key);
}

const outcomeKeys = ["active", "dry_run", "needs_setup", "degraded", "unknown", "approved", "rejected", "denied", "allowed", "blocked", "manual_review"] as const;
export function tOutcome(outcome: string, t: (key: Key) => string): string {
  if ((outcomeKeys as readonly string[]).includes(outcome)) return t(outcome as typeof outcomeKeys[number]);
  return outcome.replace(/_/g, " ");
}
