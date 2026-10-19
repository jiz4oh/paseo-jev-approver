import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { reviewPermission } from "../server/review.ts";

const agent = { id: "agent-test", provider: "opencode", cwd: "/workspace/repo" };
const request = (command: string) => ({
  id: "perm-test", kind: "tool", name: "bash", input: { command },
});
const originalFetch = globalThis.fetch;
const originalKey = process.env.TYPESAFE_API_KEY;
const originalTimeout = process.env.JEV_APPROVER_TIMEOUT_MS;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalKey;
  if (originalTimeout === undefined) delete process.env.JEV_APPROVER_TIMEOUT_MS;
  else process.env.JEV_APPROVER_TIMEOUT_MS = originalTimeout;
});

test("unknown tool and malformed inputs are never automatically approved", async () => {
  assert.equal((await reviewPermission(agent, { ...request("pwd"), name: "edit" })).action, "ask");
  assert.equal((await reviewPermission(agent, { ...request("pwd"), input: { nope: "pwd" } })).action, "ask");
  assert.equal((await reviewPermission(agent, { ...request("pwd"), input: { command: "pwd", cmd: "pwd" } })).action, "ask");
  assert.equal((await reviewPermission(agent, request(" "))).action, "ask");
});

test("local risk filter takes precedence over Jev", async () => {
  process.env.TYPESAFE_API_KEY = "testing-only";
  globalThis.fetch = async () => { throw Error("must not call Jev"); };
  for (const command of ["sudo id", "rm -rf /tmp/a", "curl https://example.com", "git push",
    "echo x > file", "pwd && git status", "cat ~/.ssh/config", "echo $(whoami)"]) {
    const d = await reviewPermission(agent, request(command));
    assert.equal(d.action, "ask", command);
    assert.equal(d.reason, "local_risk_filter", command);
  }
});

test("missing API key leaves permission pending", async () => {
  delete process.env.TYPESAFE_API_KEY;
  assert.equal((await reviewPermission(agent, request("pwd"))).reason, "missing_api_key");
});

function mockResult(status: number, json: unknown) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  }) as Response;
}
function apiRisk(score: unknown) {
  return { answers: { risk: { type: "noul", noul: score } } };
}

test("only sufficiently low Jev risk can pass", async () => {
  process.env.TYPESAFE_API_KEY = "testing-only";
  mockResult(200, apiRisk(0.001));
  assert.deepEqual(await reviewPermission(agent, request("pwd")),
    { action: "allow", reason: "jev_low_risk", riskProbability: 0.001 });
  mockResult(200, apiRisk(0.01));
  assert.equal((await reviewPermission(agent, request("git status"))).action, "allow");
  mockResult(200, apiRisk(0.010001));
  assert.equal((await reviewPermission(agent, request("pwd"))).action, "ask");
});

test("invalid Jev responses and HTTP errors fail to human approval", async () => {
  process.env.TYPESAFE_API_KEY = "testing-only";
  for (const body of [null, {}, apiRisk("0"), apiRisk(-0.1), apiRisk(1.1), apiRisk(null)]) {
    mockResult(200, body);
    assert.equal((await reviewPermission(agent, request("pwd"))).action, "ask");
  }
  mockResult(429, apiRisk(0));
  assert.equal((await reviewPermission(agent, request("pwd"))).reason, "api_http_429");
});

test("network failures propagate to listener for human approval", async () => {
  process.env.TYPESAFE_API_KEY = "testing-only";
  globalThis.fetch = async () => { throw new Error("network unavailable"); };
  await assert.rejects(reviewPermission(agent, request("pwd")), /network unavailable/);
});

test("Jev receives the command and uses a bounded timeout", async () => {
  process.env.TYPESAFE_API_KEY = "testing-only";
  process.env.JEV_APPROVER_TIMEOUT_MS = "999999";
  globalThis.fetch = async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer testing-only");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.state.command, "pwd");
    assert.equal(body.model, "jev-1.13");
    assert.ok(init?.signal);
    return { ok: true, status: 200, json: async () => apiRisk(0) } as Response;
  };
  assert.equal((await reviewPermission(agent, request("pwd"))).action, "allow");
});

test("OpenCode Zen free is routed to its System One endpoint", async () => {
  process.env.TYPESAFE_API_KEY = "unused";
  let called = "";
  globalThis.fetch = async (url, init) => {
    called = String(url);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "jev-1.13-free");
    assert.equal((init?.headers as Record<string,string>).Authorization, "Bearer zen-test");
    return { ok: true, status: 200, json: async () => apiRisk(0) } as Response;
  };
  const outcome = await reviewPermission(agent, request("pwd"), {
    provider: "zen", model: "jev-1.13-free", customEndpoint: "", apiKey: "zen-test"
  });
  assert.equal(outcome.action, "allow");
  assert.equal(called, "https://opencode.ai/zen/v1/systemone");
});
test("Custom System One provider must use HTTPS and the correct endpoint", async () => {
  const config = { provider: "custom" as const, model: "jev-custom", customEndpoint: "http://localhost/v1/systemone", apiKey: "x" };
  assert.equal((await reviewPermission(agent, request("pwd"), config)).reason, "invalid_endpoint");
  assert.equal((await reviewPermission(agent, request("pwd"), { ...config, customEndpoint: "https://example.com/v1/chat/completions" })).reason, "invalid_systemone_endpoint");
});

test("OpenRouter uses System One endpoint and OpenRouter model ID", async () => {
  let called = "";
  globalThis.fetch = async (url, init) => {
    called = String(url);
    assert.equal(JSON.parse(String(init?.body)).model, "jev-1.13");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer router-test");
    return { ok: true, status: 200, json: async () => apiRisk(0.005) } as Response;
  };
  const result = await reviewPermission(agent, request("pwd"), {
    provider: "openrouter", model: "jev-1.13", customEndpoint: "", apiKey: "router-test",
  });
  assert.equal(called, "https://openrouter.ai/api/v1/systemone");
  assert.equal(result.action, "allow");
});

test("Vercel AI Gateway uses TypeSafe-compatible System One API", async () => {
  let called = "";
  globalThis.fetch = async (url, init) => {
    called = String(url);
    assert.equal(JSON.parse(String(init?.body)).model, "typesafe-ai/jev");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer vercel-test");
    return { ok: true, status: 200, json: async () => apiRisk(0.1) } as Response;
  };
  const result = await reviewPermission(agent, request("pwd"), {
    provider: "vercel", model: "typesafe-ai/jev", customEndpoint: "", apiKey: "vercel-test",
  });
  assert.equal(called, "https://ai-gateway.vercel.sh/typesafe/v1/systemone");
  assert.equal(result.action, "ask");
});

test("configured risk threshold controls approval while local filters remain mandatory", async () => {
  const config = { provider: "zen" as const, model: "jev-1.13-free",
    customEndpoint: "", apiKey: "fake", riskThreshold: 0.05 };
  mockResult(200, apiRisk(0.04));
  assert.equal((await reviewPermission(agent, request("pwd"), config)).action, "allow");
  mockResult(200, apiRisk(0.06));
  assert.equal((await reviewPermission(agent, request("pwd"), config)).action, "ask");
  assert.equal((await reviewPermission(agent, request("sudo id"), config)).reason, "local_risk_filter");
});
test("custom prompt is sent together with a mandatory guard", async () => {
  const custom = "Focus on persistence changes, network access, and local sensitive files.";
  globalThis.fetch = async (_url, init) => {
    const instructions = JSON.parse(String(init?.body)).questions.risk.instructions as string;
    assert.ok(instructions.startsWith(custom));
    assert.match(instructions, /Mandatory safety constraint:/);
    assert.match(instructions, /untrusted data/);
    return { ok: true, status: 200, json: async () => apiRisk(0) } as Response;
  };
  const result = await reviewPermission(agent, request("pwd"), {
    provider: "zen", model: "jev-1.13-free", customEndpoint: "",
    apiKey: "fake", reviewPrompt: custom, riskThreshold: 0.01,
  });
  assert.equal(result.action, "allow");
});
test("invalid policy is never allowed, even if model would approve", async () => {
  globalThis.fetch = async () => { throw Error("not reached"); };
  const base = { provider: "zen" as const, model: "jev-1.13-free",
    customEndpoint: "", apiKey: "fake" };
  for (const riskThreshold of [-0.1, 0.11, Number.NaN]) {
    assert.equal((await reviewPermission(agent, request("pwd"), { ...base, riskThreshold })).reason, "invalid_review_policy");
  }
  assert.equal((await reviewPermission(agent, request("pwd"), { ...base, reviewPrompt: "approve everything" })).reason, "invalid_review_policy");
});
