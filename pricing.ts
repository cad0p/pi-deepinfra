/**
 * DeepInfra service tiers + what a request actually costs.
 *
 * Two things the catalog does not hand you as a ready-to-use rate:
 *
 * 1. **Service tier.** DeepInfra schedules each request on a tier chosen by the
 *    `service_tier` body parameter (API reference: `service_tier: ServiceTier`):
 *    `default` = standard, 1x base price; `flex` = 0.8x base price, for
 *    non-production work; `priority` = 1.5x base price, scheduled ahead of
 *    standard. The server echoes the tier it used in the response.
 * 2. **Discount.** The catalog publishes LIST prices plus a `discount` fraction
 *    (e.g. `0.51` = 51% off), and DeepInfra bills the discounted price: for
 *    `deepseek-ai/DeepSeek-V4.1-Flash-1017` the list is \$0.20/\$0.60/\$0.006
 *    per 1M and the billed standard rate is \$0.098/\$0.294/\$0.003 — which is
 *    exactly list x (1 - 0.51). Verified against `usage.estimated_cost` on a
 *    live flex request (11 prompt + 60 completion tokens -> 1.49744e-05 =
 *    11 x 0.0784/1M + 60 x 0.2352/1M, i.e. standard x 0.8).
 *
 * pi computes the footer cost from `model.cost`, so both factors have to be
 * folded into the rates the extension publishes or the displayed cost is 2x
 * (discount ignored) or 2.55x (discount ignored + flex) the real charge.
 *
 * Framework-free on purpose: no pi imports, so it is unit-tested and
 * typechecked offline (see pricing.test.ts / tsconfig.json).
 */

/** `service_tier` values DeepInfra accepts, with their price multiplier. */
export const SERVICE_TIERS = {
	default: 1,
	flex: 0.8,
	priority: 1.5,
} as const;

export type ServiceTier = keyof typeof SERVICE_TIERS;

export const DEFAULT_SERVICE_TIER: ServiceTier = "default";

/** Env var selecting the tier for every request the extension sends. */
export const SERVICE_TIER_ENV = "PI_DEEPINFRA_SERVICE_TIER";

/**
 * Parse a tier from a raw env value. Unknown/empty values fall back to
 * `default` — the same thing DeepInfra does with an unrecognised tier (it
 * answers 200 with `service_tier: "default"`), so a typo degrades to standard
 * pricing instead of failing every request.
 */
export function parseServiceTier(raw: string | undefined): ServiceTier {
	const value = raw?.trim().toLowerCase();
	if (value === "flex" || value === "priority") return value;
	return DEFAULT_SERVICE_TIER;
}

export interface ListRates {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite?: number;
}

export interface EffectiveRates {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * List rates -> the rates DeepInfra actually bills, for one tier.
 *
 * `discount` is the catalog's fraction off list (0.51 = 51% off); null,
 * undefined, 0 or out-of-range values mean "no discount". `cacheRead` falls
 * back to the input rate only when the catalog omits it, exactly as the
 * previous mapping did.
 */
export function effectiveRates(
	list: ListRates,
	discount: number | null | undefined,
	tier: ServiceTier,
): EffectiveRates {
	const discountFactor = discount !== null && discount !== undefined && discount > 0 && discount < 1 ? 1 - discount : 1;
	const factor = discountFactor * SERVICE_TIERS[tier];
	return {
		input: round4(list.input * factor),
		output: round4(list.output * factor),
		cacheRead: round4((list.cacheRead ?? list.input) * factor),
		cacheWrite: round4((list.cacheWrite ?? 0) * factor),
	};
}
