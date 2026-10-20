/**
 * pi-deepinfra — DeepInfra provider for pi.
 *
 * Registers the `deepinfra` provider with:
 * - Dynamic model discovery from the public catalog (https://api.deepinfra.com/v1/openai/models),
 *   loaded lazily at session start and cached on disk; startup registers the
 *   cached catalog (or a curated fallback list on first run) without ever
 *   blocking on the network, and the public catalog is picked up even when no
 *   API key is configured.
 * - `openai-completions` streaming with DeepInfra-specific compat flags
 *   (max_tokens, system role, top-level reasoning_effort for thinking levels).
 * - API key auth reading pi's credential store (~/.pi/agent/auth.json →
 *   `deepinfra` api_key entry) with DEEPINFRA_API_KEY env fallback; `/login deepinfra`
 *   prompts and stores the key.
 *
 * No statusline: pi's own footer already renders session tokens + cost, and the
 * DeepInfra monthly spend lives on the dashboard — so the extension adds no
 * second footer and makes no /payment calls.
 *
 * Usage:
 *   pi -e .                       # run with the extension
 *   /login deepinfra              # interactive API key entry (or set DEEPINFRA_API_KEY)
 *   /model deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731
 */

import { createProvider, openAICompletionsApi, type ApiKeyAuth, type Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { BASE_URL, fetchDeepInfraModels, fallbackModels, PROVIDER_ID, readCachedModels } from "./models";

const deepInfraApiKeyAuth: ApiKeyAuth = {
	name: "DeepInfra API key",
	async login(interaction) {
		const key = await interaction.prompt({
			type: "secret",
			message: "DeepInfra API key (https://deepinfra.com/dash/api_keys)",
		});
		return { type: "api_key", key };
	},
	async resolve({ ctx, credential }) {
		// Stored credential (auth.json / /login) first, env var as ambient fallback.
		const key = credential?.key ?? (await ctx.env("DEEPINFRA_API_KEY"));
		if (!key) return undefined;
		return {
			auth: { apiKey: key },
			source: credential?.key ? "stored API key" : "DEEPINFRA_API_KEY",
		};
	},
};

// The public catalog must load even when no API key is configured. pi's own
// `refreshModels` path is credential-gated (it skips providers whose auth can't
// resolve), so we cannot rely on `createProvider.fetchModels` for a keyless
// provider. Instead we register a self-managed mutable model list (the same
// pattern pi's llama.cpp provider uses) and swap the live catalog in lazily.
const CATALOG_TTL_MS = 60 * 60 * 1_000;

export default function (pi: ExtensionAPI): void {
	// 1. Register the provider IMMEDIATELY with the last cached catalog (or the
	//    curated fallback list on first run) and NEVER block startup on the
	//    network (that hangs pi at "model catalog loading"). The cache matters
	//    for clients that pick a model right after spawn (RPC `set_model`,
	//    `enabledModels`) — they cannot wait for the lazy fetch below.
	//    `createProvider` captures this array by reference and reads it on every
	//    getModels() call, so swapping its contents in place below is picked up
	//    by pi without re-registering.
	const models: Model<"openai-completions">[] = readCachedModels() ?? fallbackModels();
	pi.registerProvider(
		createProvider({
			id: PROVIDER_ID,
			name: "DeepInfra",
			baseUrl: BASE_URL,
			auth: { apiKey: deepInfraApiKeyAuth },
			models,
			api: openAICompletionsApi(),
		}),
	);

	// 2. Swap in the live public catalog lazily (fire-and-forget, never awaited,
	//    honors the session abort signal). Works with or without an API key.
	let lastFetch = 0;
	const refreshCatalog = async (signal?: AbortSignal): Promise<void> => {
		if (Date.now() - lastFetch < CATALOG_TTL_MS) return;
		lastFetch = Date.now(); // mark in-flight so a slow/stalled fetch can't re-enter
		try {
			const live = await fetchDeepInfraModels(signal);
			models.splice(0, models.length, ...live);
		} catch (error) {
			console.warn(
				`[pi-deepinfra] catalog fetch failed (${error instanceof Error ? error.message : String(error)}); keeping ${models.length} cached/fallback models`,
			);
		}
	};

	// 3. Swap the catalog in at session start (fire-and-forget, never awaited).
	pi.on("session_start", (_event, ctx) => {
		void refreshCatalog(ctx.signal);
	});
}
