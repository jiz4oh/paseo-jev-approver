import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const providerIds = ["zen", "typesafe", "openrouter", "vercel", "custom"] as const;
export const approverSettings = defineSettings({
  id: "approver",
  scope: "host",
  version: 1,
  schema: z.object({
    provider: z.enum(providerIds).default("zen"),
    model: z.string().min(1).default("jev-1.13-free"),
    customEndpoint: z.string().default(""),
    customName: z.string().default("Custom System One"),
    apiKeyEnv: z.string().default(""),
    dryRun: z.boolean().default(true),
    timeoutMs: z.number().int().min(1000).max(15000).default(6500),
  }),
});

// Credentials are NOT part of the persisted settings document.
export const saveCredential = defineRpc({
  name: "approver.credential.save",
  input: z.object({ provider: z.enum(providerIds), apiKey: z.string().min(1).max(10000) }),
  output: z.object({ saved: z.boolean() }),
});
export const clearCredential = defineRpc({
  name: "approver.credential.clear",
  input: z.object({ provider: z.enum(providerIds) }),
  output: z.object({ cleared: z.boolean() }),
});
export const credentialStatus = defineRpc({
  name: "approver.credential.status",
  input: z.object({ provider: z.enum(providerIds) }),
  output: z.object({ configured: z.boolean() }),
});
