# Verification — CI gates, offline gates, live proof

This is the verification checklist for this repository: what CI proves on every
PR, the offline gates every change runs, and what must be proven live for which
change type. It composes the repo's authoritative sources —
`.github/workflows/*`, `package.json`, `tsconfig.json` — into one file. If a
needed signal is missing here, that is a docs gap: add it in the same PR that
needed it.

## 1. How to use this file

1. Identify your change type in §4 and note its live-proof row.
2. Run the offline gates (§3) locally.
3. Push and confirm CI is green (§2) on the exact head SHA.
4. Prove live (§4) whenever the change type has a live surface — real output,
   never a substitute.
5. Put the evidence in the PR body; the PR stays **draft** (merge is the
   owner's call).

## 2. CI gates

The workflows land in the pipeline PR, not in the bootstrap PR: the validators
read `origin/main:package.json`, so a repository whose first PR carries both the
manifest and the validators can never turn the first check green. Until the
pipeline PR merges, only the offline gates in §3 run.

| Check | Workflow | What it proves |
|---|---|---|
| `install-check` | `ci.yml` | `pnpm install --frozen-lockfile` under pnpm 11 — an unapproved build script (`ERR_PNPM_IGNORED_BUILDS`) fails CI instead of breaking `pi update` locally. |
| `test` | `ci.yml` | `pnpm check` (tsc, framework-free modules only) then `pnpm test` (node:test, fully offline). |
| `validate-package-version` | `validate-package-version.yml` | Feature branches must **not** bump `package.json` `version` or edit `CHANGELOG.md`; release PRs own both. |
| `validate-release-pr` | `validate-release-pr.yml` | Release-PR shape only; exits successfully for ordinary PRs. |

`Auto Release` (`release.yml`) runs on pushes to `main`/`release/*`, not on pull
requests, so it is not a PR gate. Merging to `main` cuts a calver prerelease and
publishes it to npm under the `next` tag.

## 3. Offline gates

```bash
pnpm install --frozen-lockfile
pnpm check   # tsc --noEmit (thinking.ts + thinking.test.ts)
pnpm test    # node --test --experimental-strip-types '*.test.ts'
```

`index.ts` and `models.ts` are excluded from `tsc` on purpose: their
`@earendil-works/pi-*` imports resolve through pi's extension loader at runtime
and this package carries no pi dev-dependency (same policy as
`cad0p/pi-fallback-provider`).

## 4. Live-proof checklists

| Change type | Live proof |
|---|---|
| Thinking levels / `thinkingLevelMap` | Load the extension in a real pi session with a DeepInfra model selected and confirm the selector reaches `max` (and that `/model` cycling offers it). Independent check: `getSupportedThinkingLevels()` from the installed `@earendil-works/pi-ai` returns the full list for the resolved model. |
| Provider/compat flags | One real streaming request through the extension (`pi -e . --provider deepinfra --model <id>`) with the target model; confirm text + `reasoning_content` deltas arrive. |
| Footer / billing | Real session on a DeepInfra model: **no** DeepInfra statusline appears (pi's own footer is the only one), and no request is made to `api.deepinfra.com/payment/*`. |
| Catalog / startup | Start pi with the network blocked (or a stale cache) and confirm the provider still registers models and a session runs. |
| Service tier / wire id | Run one request per tier against a logging proxy (`baseUrl` override in `models.json` for the proof run) and confirm the body: default → `model=<catalog id>` with no `service_tier`; flex/priority → `model=<catalog id>` (never `<id>-flex`) plus `service_tier=flex\|priority`. A suffixed wire id answers `404 model_not_found`. |
| Service tier / cost | Resolve a catalog entry and check the fan-out: `<id>` (default, 1x, no `samplingParams`), `<id>-flex` (0.8x, `samplingParams.service_tier = "flex"`) and `<id>-priority` (1.5x). For `deepseek-ai/DeepSeek-V4.1-Flash-1017` that is 0.098/0.294/0.0029, 0.0784/0.2352/0.0024 and 0.147/0.441/0.0044 per 1M. Then run one real request on the `-flex` id and compare pi's recorded cost with the API's `usage.estimated_cost` for the same tokens — they must agree, which is what pins the discount and tier maths. |

## 5. What "green" means

Every required check passes on the head SHA, the PR body carries the live-proof
evidence for the change type, and the diff matches the stated intent (read the
diff — an agent's summary is intent, not outcome).
