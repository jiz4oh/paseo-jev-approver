import { useEffect, useState } from "react";
import { Text, View, Pressable, ScrollView } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import { listReviews } from "../shared/review-rpc";
import type { AuditEntry } from "../shared/review-rpc";

export function ReviewHistory(props: { params?: Record<string,string>; theme: { colors: { foreground: string; foregroundMuted: string } } }) {
  const rpc = useRpc(listReviews);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const agentId = props.params?.agentId;
  useEffect(() => {
    let live = true;
    rpc({ agentId, limit: 30, offset }).then(result => {
      if (!live) return;
      setItems(previous => offset === 0 ? result.entries : [...previous, ...result.entries]);
      setTotal(result.total);
    }).catch(() => { if (live) setError("Could not load review history"); });
    return () => { live = false; };
  }, [agentId,offset]);
  const c = props.theme.colors;
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
    <Text style={{ color: c.foreground, fontWeight: "600" }}>Review history {agentId ? "(current agent)" : ""}</Text>
    {error && <Text style={{ color: c.foregroundMuted }}>{error}</Text>}
    {items.map(item => <View key={item.id} style={{ gap: 3 }}>
      <Text style={{ color: c.foreground }}>{item.tool} · {item.outcome.replace("_"," ")}</Text>
      <Text style={{ color: c.foregroundMuted }}>{item.reason} · {new Date(item.at).toLocaleString()}</Text>
    </View>)}
    {items.length < total && <Pressable accessibilityRole="button" onPress={() => setOffset(n=>n+30)}>
      <Text style={{ color: c.foreground }}>Load more</Text>
    </Pressable>}
  </ScrollView>;
}
