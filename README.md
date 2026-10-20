# pi-deepinfra (cad0p fork)

A [pi](https://github.com/earendil-works/pi) extension that adds the **DeepInfra**
provider: 90+ hosted chat models (DeepSeek, Qwen, Llama, Gemma, Mistral, plus hosted
frontier models like Claude and Gemini), with dynamic model discovery, reasoning-effort
control, vision, and a footer statusline showing DeepInfra **monthly** usage.

Fork of [puetsua/pi-deepinfra](https://github.com/puetsua/pi-deepinfra) — see
[Differences from upstream](#differences-from-upstream).

## Install

Requires [pi](https://github.com/earendil-works/pi).

```bash
pi install npm:@cad0p/pi-deepinfra@next
```

or from source:

```bash
pi install git:github.com/cad0p/pi-deepinfra
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
| **Cost tracking** | Input/output/cache prices from the catalog ($ per 1M tokens, `cache_read_tokens` when DeepInfra publishes it). Override per model in `~/.pi/agent/models.json` if needed. Session tokens + cost are rendered by pi's own footer. |
| **No statusline** | The fork adds no footer of its own: pi already renders session tokens + cost, and the DeepInfra monthly spend lives on the dashboard. The extension makes no `/payment` calls. |

## Configuration

- **API key**: `/login deepinfra`, `DEEPINFRA_API_KEY`, or the auth.json credential.
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
