import type { PluginClientContext, PluginButtonRegistration } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { Text } from "react-native";
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
  return <Text accessibilityLabel={"Jev " + status.replace("_", " ")}
    style={{ color, fontSize: Math.max(16, props.size), lineHeight: Math.max(20, props.size + 3) }}>⛨</Text>;
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
