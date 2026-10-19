import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const auditEntry = z.object({
  id: z.string(), agentId: z.string(), requestId: z.string(), at: z.string(),
  provider: z.string(), tool: z.string(), decision: z.enum(["allow","ask"]),
  outcome: z.enum(["approved","pending","dry_run","failed","resolved_allow","resolved_deny"]),
  reason: z.string(), riskProbability: z.number().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntry>;
export const listReviews = defineRpc({
  name: "approver.reviews.list",
  input: z.object({ agentId: z.string().optional(), limit: z.number().int().min(1).max(100).default(10), offset: z.number().int().min(0).default(0) }),
  output: z.object({ entries: z.array(auditEntry), total: z.number().int() }),
});
export const getReviewStatus = defineRpc({
  name: "approver.status.get",
  input: z.object({}),
  output: z.object({
    provider: z.string(), model: z.string(), dryRun: z.boolean(),
    credentialConfigured: z.boolean(), status: z.enum(["active","dry_run","needs_setup","degraded"]),
    lastFailureAt: z.string().nullable(), detail: z.string(), nextStep: z.string(),
  }),
});
