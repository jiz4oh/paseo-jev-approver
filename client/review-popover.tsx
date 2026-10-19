import { usePluginT, tOutcome } from "./i18n";
import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { getReviewStatus, listReviews } from "../shared/review-rpc";
import type { AuditEntry } from "../shared/review-rpc";

export function createReviewPopover(openSettings: () => void, openHistory: (agentId: string) => void) {
  return function ReviewPopover(props: PluginButtonContentProps) {
    const t = usePluginT();
    const statusRpc = useRpc(getReviewStatus);
    const reviewsRpc = useRpc(listReviews);
    const [status, setStatus] = useState<Awaited<ReturnType<typeof statusRpc>> | null>(null);
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [error, setError] = useState(false);
    const agentId = props.context === "agent" ? props.agentId : undefined;
    useEffect(() => {
      let live = true;
      Promise.all([statusRpc({}), reviewsRpc({ agentId, limit: 3, offset: 0 })])
        .then(([s,r]) => { if (live) { setStatus(s); setEntries(r.entries); } })
        .catch(() => { if (live) setError(true); });
      return () => { live = false; };
    }, [agentId]);
    const translatedDetail = (value: string) => {
      const missing = /^No API key is configured for (.+)\.$/.exec(value);
      if (missing) return t("No API key is configured for") + " " + missing[1];
      switch (value) {
        case "Jev is ready for eligible pending permission requests.": return t("Jev is ready for eligible pending permission requests.");
        case "Only permission requests surfaced by Paseo can be reviewed.": return t("Only permission requests surfaced by Paseo can be reviewed.");
        case "Dry Run is enabled; the plugin evaluates but never approves.": return t("Dry Run is enabled; the plugin evaluates but never approves.");
        case "Review decisions first. To allow auto-approval, disable Dry Run in Settings.": return t("Review decisions first. To allow auto-approval, disable Dry Run in Settings.");
        case "A recent review failed; manual approvals remain available.": return t("A recent review failed; manual approvals remain available.");
        case "Inspect Review history and plugin logs, then check your provider connection.": return t("Inspect Review history and plugin logs, then check your provider connection.");
        case "Provider settings are incomplete or invalid.": return t("Provider settings are incomplete or invalid.");
        case "Open Settings and finish the provider configuration.": return t("Open Settings and finish the provider configuration.");
        case "Open Settings, enter the API key under Credentials, then reopen this panel.": return t("Open Settings, enter the API key under Credentials, then reopen this panel.");
        default: return value;
      }
    };
    const colors = props.theme.colors;
    const statusColor = status?.status === "active" ? "#16a34a"
      : status?.status === "degraded" || status?.status === "needs_setup" ? "#d97706"
      : colors.foregroundMuted;
    return <View style={{ gap: 12, padding: 8, minWidth: 260 }}>
      <Text style={{ fontWeight: "600", color: colors.foreground }}>{t("Jev Approver")}</Text>
      <Text style={{ color: error ? colors.foregroundMuted : statusColor, fontWeight: status ? "600" : "400" }}>
        {error ? t("Unable to read daemon status") : status ? tOutcome(status.status,t) : t("Loading…")}
      </Text>
      {status && <>
        <Text style={{ color: colors.foregroundMuted }}>{status.provider} · {status.model}</Text>
        <Text style={{ color: colors.foreground }}>{translatedDetail(status.detail)}</Text>
        <Text style={{ color: colors.foregroundMuted }}>{translatedDetail(status.nextStep)}</Text>
        {status.status === "needs_setup" && <Pressable accessibilityRole="button"
          onPress={() => { props.close(); openSettings(); }}>
          <Text style={{ color: colors.accent || colors.foreground }}>{t("Configure API key →")}</Text>
        </Pressable>}
      </>}
      <Text style={{ fontWeight: "600", color: colors.foreground }}>{t("Recent reviews")}</Text>
      {entries.length === 0 && <Text style={{ color: colors.foregroundMuted }}>{t("No reviews yet")}</Text>}
      {entries.map(entry => <View key={entry.id} style={{ gap: 2 }}>
        <Text style={{ color: colors.foreground }}>{entry.tool} · {tOutcome(entry.outcome,t)}</Text>
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>{entry.reason} · {new Date(entry.at).toLocaleString()}</Text>
      </View>)}
      <Pressable accessibilityRole="button" onPress={() => { props.close(); if (agentId) openHistory(agentId); }}>
        <Text style={{ color: colors.accent || colors.foreground }}>{t("View all history")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { props.close(); openSettings(); }}>
        <Text style={{ color: colors.accent || colors.foreground }}>{t("Settings")}</Text>
      </Pressable>
    </View>;
  };
}
