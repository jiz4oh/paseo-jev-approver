import type { PluginServerContext } from "@getpaseo/plugin/server";
import { reviewPermission } from "./server/review";

export default function contribute(server: PluginServerContext) {
  const inFlight = new Set<string>();
  server.on("agent.permission_requested", async (event, context) => {
    if (event.request.kind !== "tool") return;
    const key = `${event.agent.id}:${event.request.id}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      const decision = await reviewPermission(event.agent, event.request);
      const log = { component: "paseo-jev-approver", agent: event.agent.id, request: event.request.id, ...decision };
      console.info(JSON.stringify(log));
      if (decision.action !== "allow" || process.env.JEV_APPROVER_DRY_RUN !== "false") return;
      await context.paseo.agents.ref(event.agent.id).respondToPermission({
        requestId: event.request.id,
        response: { behavior: "allow" },
      });
    } catch (error) {
      // Fail open to the HUMAN APPROVAL QUEUE, never auto-approve on errors.
      console.warn(JSON.stringify({ component: "paseo-jev-approver", agent: event.agent.id,
        request: event.request.id, action: "ask", reason: error instanceof Error ? error.message : "unknown_error" }));
    } finally {
      inFlight.delete(key);
    }
  });
  return () => inFlight.clear();
}
