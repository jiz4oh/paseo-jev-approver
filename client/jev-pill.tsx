import type { PluginClientContext, PluginButtonRegistration } from "@getpaseo/plugin/client";
import { createReviewPopover } from "./review-popover";

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
      button: { title: "Jev Approver status and reviews", label: "Jev", icon: "ShieldCheck",
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
