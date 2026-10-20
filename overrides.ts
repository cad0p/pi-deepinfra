/**
 * models.json `modelOverrides` inheritance for tier variants.
 *
 * pi keys `modelOverrides` by the EXACT model id and applies them after the
 * extension's models (`provider-composer.js`), so an override written for
 * `deepseek-ai/DeepSeek-V4.1-Flash-1017` would not reach
 * `…-flex`/`…-priority` — a 400K context cap on the base id would silently
 * leave the tier variants at the advertised 1M.
 *
 * This module closes that gap with the usual specificity rule:
 *
 *   effective(variant) = pi applies variantOverride(extension applies baseOverride)
 *
 * i.e. the base id's override is inherited by every tier variant, and an
 * override written for the variant id itself wins field by field (pi applies it
 * afterwards, on top). Only the fields below are merged — the subset pi's own
 * override supports and this extension can honour.
 *
 * Framework-free on purpose: no pi imports, unit-tested offline
 * (see overrides.test.ts / tsconfig.json).
 */

export interface ModelOverride {
	name?: string;
	reasoning?: boolean;
	thinkingLevelMap?: Record<string, string | null>;
	input?: readonly string[];
	cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
	contextWindow?: number;
	maxTokens?: number;
	compat?: Record<string, unknown>;
}

/** The slice of a model an override can touch. */
export interface OverridableModel {
	id: string;
	name: string;
	reasoning: boolean;
	thinkingLevelMap?: Record<string, string | null>;
	input: readonly string[];
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
	compat?: Record<string, unknown>;
}

const TIER_SUFFIXES = ["-flex", "-priority"] as const;

/** `…-flex` -> `…`; any other id is returned unchanged. */
export function stripTierSuffix(id: string): string {
	for (const suffix of TIER_SUFFIXES) {
		if (id.endsWith(suffix)) return id.slice(0, -suffix.length);
	}
	return id;
}

/**
 * Field-by-field merge, `specific` winning. `cost` and `compat` merge per key
 * (so a variant can bump `contextWindow` only), everything else replaces.
 */
export function mergeOverrides(base: ModelOverride | undefined, specific: ModelOverride | undefined): ModelOverride {
	if (!base) return specific ?? {};
	if (!specific) return base;
	const merged: ModelOverride = { ...base, ...specific };
	const cost = base.cost || specific.cost ? { ...base.cost, ...specific.cost } : undefined;
	const compat = base.compat || specific.compat ? { ...base.compat, ...specific.compat } : undefined;
	if (cost) merged.cost = cost;
	if (compat) merged.compat = compat;
	return merged;
}

/** Apply an override to a model, mirroring pi's merge semantics for these fields. */
export function applyOverride<T extends OverridableModel>(model: T, override: ModelOverride | undefined): T {
	if (!override) return model;
	return {
		...model,
		name: override.name ?? model.name,
		reasoning: override.reasoning ?? model.reasoning,
		thinkingLevelMap: override.thinkingLevelMap
			? { ...model.thinkingLevelMap, ...override.thinkingLevelMap }
			: model.thinkingLevelMap,
		input: (override.input as T["input"] | undefined) ?? model.input,
		cost: override.cost
			? {
					input: override.cost.input ?? model.cost.input,
					output: override.cost.output ?? model.cost.output,
					cacheRead: override.cost.cacheRead ?? model.cost.cacheRead,
					cacheWrite: override.cost.cacheWrite ?? model.cost.cacheWrite,
				}
			: model.cost,
		contextWindow: override.contextWindow ?? model.contextWindow,
		maxTokens: override.maxTokens ?? model.maxTokens,
		compat: override.compat ? { ...model.compat, ...override.compat } : model.compat,
	};
}

/**
 * Pull `providers[<providerId>].modelOverrides` out of a parsed models.json.
 * Returns an empty map when the shape is unexpected — a broken config must not
 * stop the provider from registering.
 */
export function pickOverrides(config: unknown, providerId: string): Record<string, ModelOverride> {
	const providers = (config as { providers?: Record<string, { modelOverrides?: unknown }> } | undefined)?.providers;
	const overrides = providers?.[providerId]?.modelOverrides;
	if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return {};
	const result: Record<string, ModelOverride> = {};
	for (const [id, value] of Object.entries(overrides as Record<string, unknown>)) {
		if (value && typeof value === "object" && !Array.isArray(value)) result[id] = value as ModelOverride;
	}
	return result;
}

/** Tolerant models.json parse (pi allows // and /* *\/ comments). */
export function parseModelsJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		// fall through to the comment-stripping retry
	}
	try {
		const stripped = text
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "")
			.replace(/,(\s*[}\]])/g, "$1");
		return JSON.parse(stripped);
	} catch {
		return undefined;
	}
}
