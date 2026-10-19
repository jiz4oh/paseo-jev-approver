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
    assert.equal(body.model, "jev-1.13.0");
    assert.ok(init?.signal);
    return { ok: true, status: 200, json: async () => apiRisk(0) } as Response;
  };
  assert.equal((await reviewPermission(agent, request("pwd"))).action, "allow");
});
