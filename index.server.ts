import type { PluginServerContext } from "@getpaseo/plugin/server";
import { reviewPermission } from "./server/review";
import { approverSettings, saveCredential, clearCredential, credentialStatus } from "./shared/config";
import { getApiKey, saveApiKey, clearApiKey, apiKeyStatus } from "./server/credentials";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(approverSettings);
  server.handle(saveCredential, async ({ provider, apiKey }) => saveApiKey(provider, apiKey));
  server.handle(clearCredential, async ({ provider }) => clearApiKey(provider));
  server.handle(credentialStatus, async ({ provider }) => apiKeyStatus(provider));
  const inFlight = new Set<string>();
  const remove = server.on("agent.permission_requested", async (event, context) => {
    if (event.request.kind !== "tool") return;
    const key = `${event.agent.id}:${event.request.id}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      const result = await settings.read();
      if (result.status !== "ready") return;
      const cfg = result.values;
      const env = cfg.apiKeyEnv.trim();
      const apiKey = (env ? process.env[env] : undefined)
        || await getApiKey(cfg.provider)
        || (cfg.provider === "zen" ? process.env.OPENCODE_API_KEY : undefined)
        || (cfg.provider === "typesafe" ? process.env.TYPESAFE_API_KEY : undefined)
        || (cfg.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined)
        || (cfg.provider === "vercel" ? process.env.AI_GATEWAY_API_KEY : undefined);
      const decision = await reviewPermission(event.agent, event.request, { ...cfg, apiKey });
      console.info(JSON.stringify({ component: "paseo-jev-approver", agent: event.agent.id,
        request: event.request.id, action: decision.action, reason: decision.reason,
        riskProbability: decision.riskProbability, provider: cfg.provider }));
      if (decision.action !== "allow" || cfg.dryRun || process.env.JEV_APPROVER_DRY_RUN !== "false") return;
      await context.paseo.agents.ref(event.agent.id).respondToPermission({
        requestId: event.request.id, response: { behavior: "allow" },
      });
    } catch {
      console.warn(JSON.stringify({ component: "paseo-jev-approver",
        agent: event.agent.id, request: event.request.id, action: "ask", reason: "review_failed" }));
    } finally { inFlight.delete(key); }
  });
  return () => { remove(); inFlight.clear(); };
}
