# @cad0p/pi-deepinfra-provider

A [pi](https://github.com/earendil-works/pi) extension that adds the **DeepInfra**
provider: 90+ hosted chat models (DeepSeek, Qwen, Llama, Gemma, Mistral, plus hosted
frontier models like Claude and Gemini), with dynamic model discovery, reasoning-effort
control, vision, and a footer statusline showing DeepInfra **monthly** usage.

Fork of [puetsua/pi-deepinfra](https://github.com/puetsua/pi-deepinfra) — see
[Differences from upstream](#differences-from-upstream).

## Install

Requires [pi](https://github.com/earendil-works/pi).

```bash
pi install npm:@cad0p/pi-deepinfra-provider@next
```

or from source:

```bash
pi install git:github.com/cad0p/pi-deepinfra-provider
```

1. Authenticate — either:

   - **Interactive**: inside pi, run `/login deepinfra` and paste your API key
     (from https://deepinfra.com/dash/api_keys). The key is stored in
     `~/.pi/agent/auth.json`.
   - **Environment**: set `DEEPINFRA_API_KEY` in your shell.

   If a `deepinfra` `api_key` entry already exists in `~/.pi/agent/auth.json`,
   it is picked up automatically.

2. Restart pi (or `/reload`), then select a model:

   ```
   /model deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731
   ```

## What you get

| Feature | Notes |
|---|---|
| **Model catalog** | Registered instantly with a curated fallback list — startup never blocks on the network. The live catalog from `https://api.deepinfra.com/v1/openai/models` is fetched lazily at session start, swapped in over the fallback, and cached in `~/.pi/agent/cache/deepinfra-models.json` so later startups register the full catalog instantly (needed by clients that select a model right after launching pi, e.g. RPC mode) — **no API key required** (the catalog is public), so models are ready the moment a key is added. All `chat`-tagged models are registered (embeddings/image/TTS/STT excluded). |
| **Streaming** | `openai-completions` API; SSE streaming with `reasoning_content` thinking deltas on reasoning models. |
| **Thinking levels** | The full `reasoning_effort` vocabulary: `off → none`, and `minimal`/`low`/`medium`/`high`/`xhigh`/`max` pass through by name. DeepInfra validates one global enum for every chat model (an invalid value returns HTTP 422 listing `none, minimal, low, medium, high, xhigh, max`), so `Ctrl+P` / `/model` cycling offers every level including `max`. |
| **Vision** | `vision`-tagged models accept image input. |
| **Tool calling** | Standard OpenAI `tools`/`tool_choice`. |
| **Cost tracking** | The rates published to pi are what DeepInfra actually bills: catalog **list** prices x the published `discount` x the service-tier multiplier ($ per 1M tokens). Upstream maps list prices only, which overstates the footer by ~2x (or ~2.55x on flex). Verified against the API's `usage.estimated_cost`. |
| **Service tiers as models** | Every catalog model gets three entries, so you pick the tier by picking a model (works with `/model`, scoped models, subagents, fallback chains — and lets two tiers of the same model coexist): `deepinfra/<id>` = default 1x, `deepinfra/<id>-flex` = flex 0.8x (non-production), `deepinfra/<id>-priority` = priority 1.5x. The tier is sent as the `service_tier` body parameter, and the request's `model` is rewritten back to the catalog id (pi sends `model.id`, so a suffixed id would be a `404 model_not_found` at DeepInfra); each entry carries its own tier-adjusted rates, so pi's cost is the billed cost. |
| **No statusline** | The fork adds no footer of its own: pi already renders session tokens + cost, and the DeepInfra monthly spend lives on the dashboard. The extension makes no `/payment` calls. |

## Configuration

- **API key**: `/login deepinfra`, `DEEPINFRA_API_KEY`, or the auth.json credential.
- **Service tier**: pick the model id — `deepinfra/<id>-flex` or `deepinfra/<id>-priority`; the bare id is the default tier. No env var, no restart, and no state: the id says what you pay.

  ```
  /model deepinfra/deepseek-ai/DeepSeek-V4.1-Flash-1017-flex
  pi --model deepinfra/deepseek-ai/DeepSeek-V4.1-Flash-1017-priority "…"
  ```
- **Per-model overrides** (prices, context, max tokens, thinking levels): standard
  pi `~/.pi/agent/models.json` mechanism, e.g.:

  ```json
  {
    "providers": {
      "deepinfra": {
        "modelOverrides": {
          "deepseek-ai/DeepSeek-V4.1-Flash-1017": {
            "contextWindow": 400000
          }
        }
      }
    }
  }
  ```

  Note: `models.json` `models` entries replace the extension's models for that
  provider — set a full `models` list there if you use it.

## Differences from upstream

1. **Thinking levels cover the whole enum.** Upstream maps only `off → none`, so
   pi's `getSupportedThinkingLevels()` stops at `high` (pi only offers
   `xhigh`/`max` when `thinkingLevelMap` names them explicitly) and a `max`
   request is silently clamped to `high`. Verified against the live API: the
   validator accepts `none/minimal/low/medium/high/xhigh/max` for every chat
   model, so the map is complete.
2. **No footer at all.** Upstream renders `↑in ↓out · $cost · M: $spent` while
   pi's own footer already renders `↑in ↓out $cost`; the monthly figure is on
   the DeepInfra dashboard. The fork drops the statusline, the
   `/deepinfra-billing` command, the per-message recomputation, and the
   `/payment/*` calls with it.

3. **Real costs.** Upstream maps catalog list prices straight into `model.cost`, ignoring the catalog's `discount` field, so pi's footer shows ~2x the real charge; the fork folds in the discount and the service tier (see `pricing.ts`).
4. **Service tiers are models.** Upstream never sends `service_tier`, so every request runs standard. The fork registers `<id>`, `<id>-flex` and `<id>-priority` (see `tiers.ts`), each with its own `samplingParams` and rates; the wire id stays the catalog id (see `wire.ts`), since DeepInfra rejects the suffixed siblings.

Everything else — catalog discovery, caching, auth, compat flags — is upstream's.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check   # tsc --noEmit (thinking.ts + its test; pi-importing files are excluded)
pnpm test    # node --test (offline)
```

See [docs/verification.md](docs/verification.md) for the CI gates and live-proof
checklists.

## License

MIT — see [LICENSE](LICENSE). Original work © 2026 puetsua.
