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
    const colors = props.theme.colors;
    return <View style={{ gap: 12, padding: 8, minWidth: 260 }}>
      <Text style={{ fontWeight: "600", color: colors.foreground }}>{t("Jev Approver")}</Text>
      <Text style={{ color: colors.foregroundMuted }}>
        {error ? t("Unable to read daemon status") : status ? tOutcome(status.status,t) : t("Loading…")}
      </Text>
      {status && <>
        <Text style={{ color: colors.foregroundMuted }}>{status.provider} · {status.model}</Text>
        <Text style={{ color: colors.foreground }}>{status.detail}</Text>
        <Text style={{ color: colors.foregroundMuted }}>{status.nextStep}</Text>
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
