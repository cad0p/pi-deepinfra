import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_SERVICE_TIER,
	effectiveRates,
	parseServiceTier,
	SERVICE_TIERS,
} from "./pricing.ts";

test("tiers carry DeepInfra's published multipliers", () => {
	assert.deepEqual(SERVICE_TIERS, { default: 1, flex: 0.8, priority: 1.5 });
	assert.equal(DEFAULT_SERVICE_TIER, "default");
});

test("parseServiceTier accepts the real tiers, case/space tolerant", () => {
	assert.equal(parseServiceTier("flex"), "flex");
	assert.equal(parseServiceTier("  FLEX "), "flex");
	assert.equal(parseServiceTier("priority"), "priority");
	assert.equal(parseServiceTier("default"), "default");
});

test("parseServiceTier degrades to default instead of failing (mirrors the API)", () => {
	for (const raw of [undefined, "", "  ", "auto", "bogus", "0.8"]) {
		assert.equal(parseServiceTier(raw), "default", `${String(raw)} should fall back`);
	}
});

test("discount is applied (list 0.20/0.60/0.006 with 51% off -> 0.098/0.294/0.0029)", () => {
	const rates = effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.006 }, 0.51, "default");
	assert.equal(rates.input, 0.098);
	assert.equal(rates.output, 0.294);
	assert.equal(rates.cacheRead, 0.0029);
	assert.equal(rates.cacheWrite, 0);
});

test("flex is 0.8x the discounted rate, matching DeepInfra's live estimate", () => {
	// Live check: 11 prompt + 60 completion tokens on flex cost 1.49744e-05
	// = 11 x 0.0784/1M + 60 x 0.2352/1M.
	const rates = effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.006 }, 0.51, "flex");
	assert.equal(rates.input, 0.0784);
	assert.equal(rates.output, 0.2352);
	const expected = (11 * rates.input + 60 * rates.output) / 1_000_000;
	assert.ok(Math.abs(expected - 1.49744e-05) < 1e-12, `estimated cost drifted: ${expected}`);
});

test("priority is 1.5x the discounted rate", () => {
	const rates = effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.006 }, 0.51, "priority");
	assert.equal(rates.input, 0.147);
	assert.equal(rates.output, 0.441);
});

test("no discount means list price, per tier", () => {
	assert.deepEqual(effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.006 }, undefined, "default"), {
		input: 0.2,
		output: 0.6,
		cacheRead: 0.006,
		cacheWrite: 0,
	});
	// 0, out-of-range and non-finite discounts are all "no discount", never a
	// free model or a negative rate.
	for (const bad of [0, 1, 1.5, -0.2]) {
		const rates = effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.006 }, bad, "default");
		assert.equal(rates.input, 0.2, `discount ${bad} should be ignored`);
	}
});

test("cacheRead falls back to the input rate when the catalog omits it", () => {
	const rates = effectiveRates({ input: 0.2, output: 0.6, cacheRead: 0.2 }, null, "default");
	assert.equal(rates.cacheRead, 0.2);
});
