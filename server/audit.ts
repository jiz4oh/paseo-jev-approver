import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
// Keep the storage DTO independent of the Paseo SDK so it can be tested in isolation.
export interface AuditEntry {
  id: string; agentId: string; requestId: string; at: string;
  provider: string; tool: string; decision: "allow" | "ask";
  outcome: "approved" | "pending" | "dry_run" | "failed" | "resolved_allow" | "resolved_deny";
  reason: string; riskProbability: number | null;
}

const directory = join(process.env.XDG_STATE_HOME || join(homedir(), ".local/state"), "paseo-jev-approver");
const path = join(directory, "reviews.json");
const MAX_ENTRIES = 1000;
let records: AuditEntry[] = [];
let ready: Promise<void> | undefined;
let serial: Promise<void> = Promise.resolve();

async function load() {
  try {
    const input = JSON.parse(await readFile(path, "utf8"));
    if (Array.isArray(input)) records = input.slice(-MAX_ENTRIES);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
async function initialize() { ready ??= load(); await ready; }
function persist() {
  const snapshot = JSON.stringify(records);
  serial = serial.catch(() => {}).then(async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temp = path + ".tmp";
    await writeFile(temp, snapshot, { encoding: "utf8", mode: 0o600 });
    await rename(temp, path);
  });
  return serial;
}
export async function recordReview(record: AuditEntry) {
  await initialize();
  const index = records.findIndex(r => r.id === record.id);
  if (index >= 0) records[index] = record; else records.push(record);
  records = records.slice(-MAX_ENTRIES);
  await persist();
}
export async function resolveReview(agentId: string, requestId: string, outcome: "resolved_allow" | "resolved_deny") {
  await initialize();
  const record = [...records].reverse().find(r => r.agentId === agentId && r.requestId === requestId);
  if (!record) return;
  record.outcome = outcome;
  await persist();
}
export async function queryReviews(agentId: string | undefined, limit: number, offset: number) {
  await initialize();
  const list = records.filter(r => !agentId || r.agentId === agentId).reverse();
  return { entries: list.slice(offset, offset + limit), total: list.length };
}
