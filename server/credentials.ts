import { mkdir, readFile, writeFile, unlink, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type ProviderId = "zen" | "typesafe" | "openrouter" | "vercel" | "custom";
const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "paseo-jev-approver", "secrets");
const secretFile = (provider: ProviderId) => join(dir, provider + ".key");

export async function saveApiKey(provider: ProviderId, apiKey: string) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(secretFile(provider), apiKey.trim() + "\n", { encoding: "utf8", mode: 0o600, flag: "w" });
  await chmod(secretFile(provider), 0o600);
  return { saved: true };
}
export async function clearApiKey(provider: ProviderId) {
  try { await unlink(secretFile(provider)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { cleared: true };
}
export async function getApiKey(provider: ProviderId): Promise<string | undefined> {
  try { return (await readFile(secretFile(provider), "utf8")).trim() || undefined; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return undefined;
  }
}
export async function apiKeyStatus(provider: ProviderId) {
  return { configured: Boolean(await getApiKey(provider)) };
}
