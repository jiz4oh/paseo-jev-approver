import type { PluginClientContext, PluginButtonRegistration } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import type { PluginButtonIconProps } from "@getpaseo/plugin/client";
import { getReviewStatus } from "../shared/review-rpc";
import { createReviewPopover } from "./review-popover";


function JevStatusIcon(props: PluginButtonIconProps) {
  const getStatus = useRpc(getReviewStatus);
  const [status, setStatus] = useState<"active" | "dry_run" | "needs_setup" | "degraded" | "unknown">("unknown");
  useEffect(() => {
    let active = true;
    const update = () => {
      void getStatus({}).then(result => {
        if (active) setStatus(result.status);
      }).catch(() => { if (active) setStatus("degraded"); });
    };
    update();
    const timer = setInterval(update, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [getStatus]);
  const color = status === "active" ? "#16a34a"
    : status === "degraded" || status === "needs_setup" ? "#d97706"
    : props.color;
  // U+26E8 is often drawn as a colored emoji and ignores Text.color.
  // Use primitive RN views for a consistently tintable monochrome icon.
  const size = Math.max(16, props.size);
  return <View accessibilityLabel={"Jev " + status.replace("_", " ")}
    style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: size * 0.72, height: size * 0.78, borderWidth: Math.max(1.5, size * 0.09),
      borderColor: color, borderTopLeftRadius: size * 0.13, borderTopRightRadius: size * 0.13,
      borderBottomLeftRadius: size * 0.3, borderBottomRightRadius: size * 0.3,
      alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color, fontSize: size * 0.48, lineHeight: size * 0.59, fontWeight: "700" }}>+</Text>
    </View>
  </View>;
}

export function registerJevPills(client: PluginClientContext) {
  const pills = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();
  let stopped = false;
  const Popover = createReviewPopover(
    () => client.openSettings("approver"),
    agentId => client.openScreen({ screenId: "reviews", params: { agentId } }),
  );
  const add = (agent: { id: string; workspaceId?: string | null }) => {
    if (stopped || !agent.workspaceId) return;
    pills.get(agent.id)?.remove();
    pills.set(agent.id, client.addComposerPill({
      id: "jev-status", workspaceId: agent.workspaceId, agentId: agent.id,
      button: { title: "Jev Approver status and reviews", label: "Jev", icon: JevStatusIcon,
        behavior: { kind: "popover", Content: Popover } },
    }));
  };
  const remove = (id: string) => { pills.get(id)?.remove(); pills.delete(id); };
  void client.paseo.agents.list({ subscribe: {}, signal: lifetime.signal }).then(({ subscription }) => {
    subscription.subscribe({
      snapshot: ({ entries }) => { for (const pill of pills.values()) pill.remove(); pills.clear(); for (const { agent } of entries) add(agent); },
      update: (message) => { if (message.type !== "agent_update") return;
        const change = message.payload;
        if (change.kind === "remove") remove(change.agentId); else add(change.agent);
      },
    });
  }).catch(e => { if (!stopped) console.error("Jev agent observation failed", e); });
  return () => { stopped = true; lifetime.abort(); for (const pill of pills.values()) pill.remove(); pills.clear(); };
}
