/**
 * DeepInfra `reasoning_effort` ↔ pi thinking levels.
 *
 * DeepInfra validates `reasoning_effort` against ONE global enum for every chat
 * model — `none | minimal | low | medium | high | xhigh | max` (an invalid value
 * answers HTTP 422 with exactly that list) — so pi's levels map 1:1, except
 * `off`, which DeepInfra spells `none`. `none` is accepted by every model,
 * including ones whose reasoning is effectively always-on.
 *
 * Two pi behaviours depend on this table being COMPLETE:
 *   - `getSupportedThinkingLevels()` only offers `xhigh`/`max` when the model's
 *     `thinkingLevelMap` has an explicit non-null entry for them (they are
 *     opt-in); any level mapped to `null` is hidden from the selector/footer.
 *   - unmapped levels fall back to passing the pi level name through as-is.
 *
 * Framework-free on purpose: no pi imports, so this module (and its test) is
 * typechecked and unit-tested offline — see tsconfig.json / thinking.test.ts.
 */

/** pi thinking levels, in pi's own order. */
export const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export type PiThinkingLevel = (typeof PI_THINKING_LEVELS)[number];

/** `reasoning_effort` values DeepInfra accepts (the 422 enum, verbatim). */
export const DEEPINFRA_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export type DeepInfraEffort = (typeof DEEPINFRA_EFFORTS)[number];

/**
 * pi level → DeepInfra `reasoning_effort`. Complete by construction: every pi
 * level maps to a real effort, so nothing is hidden and `max` is reachable.
 */
export type ThinkingMap = { [level in PiThinkingLevel]?: DeepInfraEffort | null };

export const THINKING_LEVEL_MAP: ThinkingMap = {
	off: "none",
	minimal: "minimal",
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
};
