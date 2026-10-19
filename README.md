# Paseo Jev Approver (prototype)

A **server-only** Paseo plugin. It reviews a narrow class of shell permission requests with TypeSafe Jev System One and only auto-approves when the risk probability is <= 0.01 and `JEV_APPROVER_DRY_RUN=false`.

## Installation

The repository contains the source files, but deliberately **no guessed SDK dependency versions**. On the target Paseo daemon host:

```bash
paseo --version
paseo plugin init /absolute/path/to/jev-approver-scaffold
cd /absolute/path/to/jev-approver-scaffold
npm install
```

Copy `index.server.ts`, `server/review.ts`, and `paseo-plugin.json` from this package over the corresponding scaffold files. Remove generated demo `index.client.tsx` if present (no client component required). Then:

```bash
npm run typecheck
export TYPESAFE_API_KEY='YOUR_TYPESAFE_API_KEY'
export JEV_APPROVER_DRY_RUN=true
paseo plugin install /absolute/path/to/jev-approver-scaffold
paseo plugin ls
paseo plugin logs jev-approver
```

Ensure the **daemon process**, not merely your shell, receives `TYPESAFE_API_KEY`, `JEV_APPROVER_DRY_RUN`, and optional `JEV_APPROVER_TIMEOUT_MS`, `JEV_APPROVER_MODEL`. How to supply environment variables depends on how your daemon is launched. Restart/reload the daemon as needed. After inspecting real approval events, set `JEV_APPROVER_DRY_RUN=false` **in the daemon environment**, then reload/restart the plugin.

Plugins must be enabled under Settings -> Plugins. Enabling them changes the global daemon security posture; do so only after reviewing the code. Plugin server code is trusted and unsandboxed.

## Coverage and policy

* Intercepts `agent.permission_requested` events with `kind === 'tool'`.
* Only evaluates requests named `bash`, `shell`, `terminal`, `execute`, or `command` with exactly one string `input.command` or `input.cmd`.
* Intentionally abstains on unknown tool shapes, compound shell commands, potentially mutating or sensitive commands and all non-tool approvals.
* Uses pinned Jev `jev-1.13.0` by default. Each assessment is logged with agent ID, request ID, action, reason, and optional risk probability, but never raw command or API key.
* Jev/network errors never approve anything. They leave the original request pending for user approval.
* Does not enforce policy on commands the agent/provider allows without asking first. Set your underlying OpenCode/Codex permissions to **ask** for operations you wish reviewed.
* Never auto-denies: local pattern matches leave requests for a human to inspect.

## Security limits

This is a conservative **prototype**, not a security boundary. A model-derived probability is not a guarantee of safety. Shell parsing is intentionally restrictive rather than comprehensive. The source is not verified against your local Paseo SDK or provider-specific permission payloads. Run in dry-run and inspect emitted events before enabling approvals.

Paseo docs: https://github.com/getpaseo/paseo/blob/main/public-docs/plugins/reference.md
Jev docs: https://docs.typesafe.ai/
