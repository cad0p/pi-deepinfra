/**
 * One model entry per DeepInfra service tier.
 *
 * pi computes cost from `model.cost` (it ignores the API's per-response
 * `usage.estimated_cost`) and `samplingParams` are per model too, so the tier
 * has to live on the model entry rather than in process state. That makes the
 * tier a naming problem: the bare catalog id is the default tier, and every
 * other tier is a suffixed sibling.
 *
 *   deepinfra/deepseek-ai/DeepSeek-V4.1-Flash-1017            default, 1x
 *   deepinfra/deepseek-ai/DeepSeek-V4.1-Flash-1017-flex       flex, 0.8x
 *   deepinfra/deepseek-ai/DeepSeek-V4.1-Flash-1017-priority   priority, 1.5x
 *
 * Framework-free on purpose: no pi imports, so it is unit-tested and
 * typechecked offline (see tiers.test.ts / tsconfig.json).
 */

import type { ServiceTier } from "./pricing.ts";

/** Every tier gets a model entry, default first. */
export const TIERS = ["default", "flex", "priority"] as const satisfies readonly ServiceTier[];

/** Suffixes that already denote a tier — never append a second one. */
const TIER_SUFFIXES = ["-flex", "-priority"] as const;

/** True when a catalog id already ends in a tier suffix. */
export function hasTierSuffix(id: string): boolean {
	return TIER_SUFFIXES.some((suffix) => id.endsWith(suffix));
}

/** Model id for one tier: the bare catalog id is the default tier. */
export function tierModelId(id: string, tier: ServiceTier): string {
	return tier === "default" ? id : `${id}-${tier}`;
}

/** Display name for one tier: the bare name is the default tier. */
export function tierModelName(name: string, tier: ServiceTier): string {
	return tier === "default" ? name : `${name} (${tier})`;
}

/** Tiers to register for a catalog id (a pre-suffixed id stays as-is). */
export function tiersFor(id: string): readonly ServiceTier[] {
	return hasTierSuffix(id) ? (["default"] as const) : TIERS;
}
