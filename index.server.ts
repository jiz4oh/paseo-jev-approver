import { randomUUID } from "node:crypto";
import { recordReview, resolveReview, queryReviews } from "./server/audit";
import { getReviewStatus, listReviews } from "./shared/review-rpc";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { reviewPermission } from "./server/review";
import { approverSettings, saveCredential, clearCredential, credentialStatus } from "./shared/config";
import { getApiKey, saveApiKey, clearApiKey, apiKeyStatus } from "./server/credentials";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(approverSettings);
  server.handle(saveCredential, async ({ provider, apiKey }) => saveApiKey(provider, apiKey));
  server.handle(clearCredential, async ({ provider }) => clearApiKey(provider));
  server.handle(credentialStatus, async ({ provider }) => apiKeyStatus(provider));
  server.handle(listReviews, async ({ agentId, limit, offset }) => queryReviews(agentId, limit, offset));
  server.handle(getReviewStatus, async () => {
    const result = await settings.read();
    const cfg = result.status === "ready" ? result.values : null;
    const provider = cfg?.provider || "zen";
    const env = cfg?.apiKeyEnv?.trim();
    const key = (env ? process.env[env] : undefined)
      || await getApiKey(provider)
      || (provider === "zen" ? process.env.OPENCODE_API_KEY : undefined)
      || (provider === "typesafe" ? process.env.TYPESAFE_API_KEY : undefined)
      || (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined)
      || (provider === "vercel" ? process.env.AI_GATEWAY_API_KEY : undefined);
    const dryRun = cfg?.dryRun !== false || process.env.JEV_APPROVER_DRY_RUN !== "false";
    const lastError = (await queryReviews(undefined, 100, 0)).entries.find(e => e.outcome === "failed");
    const recent = lastError && Date.now() - Date.parse(lastError.at) < 15 * 60_000;
    return { provider, model: cfg?.model || "jev-1.13-free", dryRun,
      credentialConfigured: Boolean(key), status: !key ? "needs_setup" as const
        : recent ? "degraded" as const : dryRun ? "dry_run" as const : "active" as const,
      lastFailureAt: lastError?.at || null };
  });
  server.on("agent.permission_resolved", async ({ agent, requestId, resolution }) => {
    await resolveReview(agent.id, requestId, resolution.behavior === "allow" ? "resolved_allow" : "resolved_deny");
  });
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
      const dryRun = cfg.dryRun || process.env.JEV_APPROVER_DRY_RUN !== "false";
      const row = { id: randomUUID(), agentId: event.agent.id, requestId: event.request.id,
        at: new Date().toISOString(), provider: cfg.provider, tool: event.request.name,
        decision: decision.action, outcome: (decision.action !== "allow" ? "pending" : dryRun ? "dry_run" : "pending") as "pending"|"dry_run"|"approved",
        reason: decision.reason, riskProbability: decision.riskProbability ?? null };
      await recordReview(row);
      if (decision.action !== "allow" || dryRun) return;
      await context.paseo.agents.ref(event.agent.id).respondToPermission({
        requestId: event.request.id, response: { behavior: "allow" },
      });
      await recordReview({ ...row, outcome: "approved" });
    } catch {
      console.warn(JSON.stringify({ component: "paseo-jev-approver",
        agent: event.agent.id, request: event.request.id, action: "ask", reason: "review_failed" }));
      try {
        await recordReview({ id: randomUUID(), agentId: event.agent.id, requestId: event.request.id,
          at: new Date().toISOString(), provider: event.agent.provider, tool: event.request.name,
          decision: "ask", outcome: "failed", reason: "review_failed", riskProbability: null });
      } catch {
        console.warn("Jev audit persistence failed");
      }
    } finally { inFlight.delete(key); }
  });
  return () => { remove(); inFlight.clear(); };
}
