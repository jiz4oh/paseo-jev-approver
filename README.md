# Paseo Jev Approver (prototype)

A Paseo plugin with a client settings page and daemon-side approval logic. It reviews a narrow class of shell permission requests with TypeSafe Jev System One and only auto-approves when the risk probability is <= 0.01.

## Installation

## Install directly from GitHub

On the **Paseo daemon machine**, use the built-in Git source installer:

```bash
paseo --version
paseo plugin install github:jiz4oh/paseo-jev-approver
paseo plugin ls jev-approver
paseo plugin logs jev-approver
```

A first install may fail at dependency preparation or TypeScript compilation while the integration is still experimental. For development, clone the repository, use `paseo plugin init` to generate a plugin scaffold compatible with your installed Paseo, and reconcile its generated `package.json` and `tsconfig.json` with this source. Do not turn on automatic approval until the daemon loads the plugin and you've verified real permission payloads in dry-run mode.


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
paseo plugin install /absolute/path/to/jev-approver-scaffold
paseo plugin ls
paseo plugin logs jev-approver
```

Ensure the **daemon process**, not merely your shell, receives `TYPESAFE_API_KEY`, and optional Settings-managed timeout and model. How to supply environment variables depends on how your daemon is launched. Restart/reload the daemon as needed. After inspecting real approval events, turn off **Dry Run** in Settings.

Plugins must be enabled under Settings -> Plugins. Enabling them changes the global daemon security posture; do so only after reviewing the code. Plugin server code is trusted and unsandboxed.

## Coverage and policy

* Intercepts `agent.permission_requested` events with `kind === 'tool'`.
* Only evaluates requests named `bash`, `shell`, `terminal`, `execute`, or `command` with exactly one string `input.command` or `input.cmd`.
* Intentionally abstains on unknown tool shapes, compound shell commands, potentially mutating or sensitive commands and all non-tool approvals.
* Uses pinned Jev `jev-1.13.0` by default. Each assessment is logged with agent ID, request ID, action, reason, and optional risk probability, but never raw command or API key.
* Jev/network errors never approve anything. They leave the original request pending for user approval.
* Does not enforce policy on commands the agent/provider allows without asking first. Set your underlying OpenCode/Codex permissions to **ask** for operations you wish reviewed.
* Never auto-denies: local pattern matches leave requests for a human to inspect.


## Setup diagnosis

If the composer pill says **Needs Setup**, open the popover for the explicit reason and next step. Usually no API key is available to the daemon for the selected provider. Go to **Settings → Plugins → Jev Approver → Credentials**, enter the key and press **Save key** (or configure the daemon environment-variable reference), then reopen the Jev popover. Missing or invalid provider settings are identified separately. Dry Run and recent API failures also show actionable explanations.

**View history** is available from both the composer Jev popover and the plugin Settings screen; opening it from Settings shows all agents, while opening it from an Agent pill filters to that Agent.

## Jev Composer status and review history

The plugin registers a small **Jev** pill beside each agent's composer using the supported Paseo `addComposerPill` API. Pressing the pill opens a native desktop popover or compact mobile sheet showing the configured provider/model, runtime status and the three most recent decisions for that agent. **Settings** opens the existing Jev Approver settings page. **View all history** opens a paged native plugin screen.

The daemon persists up to 1,000 audit entries in `${XDG_STATE_HOME:-~/.local/state}/paseo-jev-approver/reviews.json`, with no raw shell commands, API keys or request payloads. Each record contains agent/request IDs, a tool name, decision reason and probability when available, and its tracked approval outcome. The history screen is filtered to the selected agent. On a successful auto-approval call the record changes to `approved`; Paseo permission-resolution events can update it to `resolved_allow` or `resolved_deny`. `pending` means the plugin left the request for human approval, not that the user denied it.

The status tag is **not** an approval-mode switch: it does not change Paseo's Default/Auto Accept controls. `active` means configuration appears ready (not that every tool is intercepted or that the provider is confirmed online). `degraded` reflects a recent recorded review failure. Settings remain daemon-scoped, and UI review data is loaded via plugin RPC.

**Integration status:** The client and server registration files are not covered by the current CI TypeScript project and have not yet been exercised in a real Paseo daemon. Verify installation, navigation, RPC, popover rendering and real permission events with Dry-run enabled before production use.

## Provider configuration

Open **Settings → Plugins → Jev Approver** in a Paseo client connected to the target daemon.

- **OpenCode Zen** (default): `jev-1.13-free`, endpoint `https://opencode.ai/zen/v1/systemone`. Sign up for a Zen key; free model pricing does **not** mean unauthenticated access. Temporary availability may change.
- **OpenRouter**: model \`jev-1.13\`, endpoint \`https://openrouter.ai/api/v1/systemone\`. API key via Settings or \`OPENROUTER_API_KEY\` on the daemon.\n- **Vercel AI Gateway**: model \`typesafe-ai/jev\`, endpoint \`https://ai-gateway.vercel.sh/typesafe/v1/systemone\`. API key via Settings or \`AI_GATEWAY_API_KEY\` on the daemon.\n- **TypeSafe AI**: `jev-1.13`, endpoint `https://api.typesafe.ai/v1/systemone`.
- **Custom System One**: an explicit HTTPS `/systemone` URL and model identifier. Generic OpenAI, Anthropic, or Gemini Chat APIs are **not** System One endpoints and cannot directly return Jev's typed probability response.

Paste an API key in the plugin settings and choose **Save key**, or configure the name of an environment variable already exported to the daemon. For Zen, `OPENCODE_API_KEY` is also a fallback; for TypeSafe, `TYPESAFE_API_KEY`. The UI never reads back key values. Key files reside at `${XDG_CONFIG_HOME:-~/.config}/paseo-jev-approver/secrets/<provider>.key` with owner-only permissions on Unix-like hosts. Paseo's ordinary settings store contains provider/model/URL/env-reference only, not raw credentials.

**Approval is controlled by Settings Dry Run only.** Keep it enabled while testing. Turn it off to permit eligible low-risk approvals. Jev errors and unrecognized commands leave human approval pending.

**Important**: settings-based credential storage and the plugin client entry have not yet been compiled against your specific Paseo installation. The repository's CI still covers only `server/review.ts`, not Paseo UI or SDK integration.

## Development and CI

The repository runs **offline/mock unit tests** for the Jev permission decision logic; no real TypeSafe API key or Paseo daemon is needed:

```bash
npm install
npm run check
```

GitHub Actions runs the same check on pushes to `main` and on pull requests. Tests cover unsupported/malformed requests, local risk filters, missing API key, risk score thresholds, invalid responses, API HTTP errors, and network failures.

**Current CI scope:** `tsconfig.json` intentionally checks `server/review.ts` and `tests/*.test.ts` only. It does **not** compile or execute `index.server.ts`, because that requires the matching Paseo plugin SDK from a generated scaffold. Do not interpret a green CI badge as proven Paseo daemon compatibility. End-to-end tests with real provider permission events and a dry-run review are required before enabling auto-approve.

## Security limits

This is a conservative **prototype**, not a security boundary. A model-derived probability is not a guarantee of safety. Shell parsing is intentionally restrictive rather than comprehensive. The source is not verified against your local Paseo SDK or provider-specific permission payloads. Run in dry-run and inspect emitted events before enabling approvals.

Paseo docs: https://github.com/getpaseo/paseo/blob/main/public-docs/plugins/reference.md
Jev docs: https://docs.typesafe.ai/

## Dry Run control

The Settings **Dry Run** switch is the sole control for automatic approval. It defaults to enabled on a fresh installation. The legacy `JEV_APPROVER_DRY_RUN` environment variable is ignored. Turning Dry Run off permits the plugin to automatically approve only eligible low-risk permission requests; errors and unsupported operations still require human approval.

## Runtime settings and status colors

The provider model and API request timeout (1,000–15,000 ms, default 6,500 ms) are configured in **Settings → Plugins → Jev Approver**. Legacy `JEV_APPROVER_TIMEOUT_MS` and `JEV_APPROVER_MODEL` variables are ignored by the live review path. Provider key environment variables and XDG standard directory variables remain available.

The Composer Jev icon is now status-aware: green when active, muted in dry run, amber when setup is missing or review failures occur. Its status is refreshed periodically while the composer is mounted. A green icon means the reviewer is configured for eligible pending permissions, not that every tool call is intercepted.
