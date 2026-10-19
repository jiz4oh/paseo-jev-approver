import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("audit entries persist, filter by agent, paginate and reconcile outcomes", async () => {
  const temp = await mkdtemp(join(tmpdir(), "paseo-jev-audit-"));
  process.env.XDG_STATE_HOME = temp;
  try {
    const { recordReview, queryReviews, resolveReview } = await import("../server/audit.ts");
    const basic = { at: "2026-10-19T10:00:00.000Z", provider: "zen", tool: "bash",
      decision: "ask" as const, outcome: "pending" as const, reason: "local_risk_filter",
      riskProbability: null };
    await recordReview({ ...basic, id: "a", agentId: "agent-1", requestId: "req-1" });
    await recordReview({ ...basic, id: "b", agentId: "agent-2", requestId: "req-2" });
    assert.equal((await queryReviews(undefined, 10, 0)).total, 2);
    assert.equal((await queryReviews("agent-1", 10, 0)).total, 1);
    assert.equal((await queryReviews(undefined, 1, 1)).entries[0]?.id, "a");
    await resolveReview("agent-1", "req-1", "resolved_allow");
    assert.equal((await queryReviews("agent-1", 10, 0)).entries[0]?.outcome, "resolved_allow");
    const raw = await readFile(join(temp, "paseo-jev-approver", "reviews.json"), "utf8");
    assert.equal(JSON.parse(raw).length, 2);
    assert.equal(raw.includes("API_KEY"), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
