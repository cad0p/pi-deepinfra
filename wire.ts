/**
 * What a tier model sends on the wire.
 *
 * pi sends `model.id` as the request body's `model` (pi-ai's
 * openai-completions `buildParams`: `model: model.id`), so a tier-suffixed
 * id would be sent verbatim and DeepInfra answers 404 — the suffixed ids are
 * this extension's invention, not DeepInfra's:
 *
 *   {"error":{"message":"The model `deepseek-ai/DeepSeek-V4.1-Flash-1017-flex`
 *    does not exist","type":"invalid_request_error","code":"model_not_found"}}
 *
 * pi assigns `model.samplingParams` LAST, over named request fields
 * ("Last so model and request sampling parameters override named request
 * fields"), so the tier's samplingParams can carry the catalog id back into
 * `model` and add the `service_tier` the price is based on. The model entry
 * keeps the suffixed id, so cost, session attribution and thinking levels stay
 * per tier — only the request body is rewritten.
 *
 * Framework-free on purpose: no pi imports, so it is unit-tested and
 * typechecked offline (see wire.test.ts / tsconfig.json).
 */

import type { ServiceTier } from "./pricing.ts";

/**
 * `samplingParams` for one tier, or undefined for the default tier (which is
 * the bare catalog id and needs no rewriting).
 */
export function tierWireParams(catalogId: string, tier: ServiceTier): Record<string, unknown> | undefined {
	if (tier === "default") return undefined;
	return { model: catalogId, service_tier: tier };
}
