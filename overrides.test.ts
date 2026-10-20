import assert from "node:assert/strict";
import { test } from "node:test";

import {
	applyOverride,
	mergeOverrides,
	parseModelsJson,
	pickOverrides,
	stripTierSuffix,
} from "./overrides.ts";

const model = {
	id: "deepseek-ai/DeepSeek-V4.1-Flash-1017-flex",
	name: "DeepSeek-V4.1-Flash-1017 (flex)",
	reasoning: true,
	input: ["text", "image"] as readonly string[],
	cost: { input: 0.0784, output: 0.2352, cacheRead: 0.0024, cacheWrite: 0 },
	contextWindow: 1_048_576,
	maxTokens: 1_048_576,
	compat: { maxTokensField: "max_tokens" },
};

test("the tier suffix is stripped to the base id", () => {
	assert.equal(stripTierSuffix("a/b-flex"), "a/b");
	assert.equal(stripTierSuffix("a/b-priority"), "a/b");
	assert.equal(stripTierSuffix("a/b"), "a/b");
	assert.equal(stripTierSuffix("a/b-flexible"), "a/b-flexible");
});

test("a base override reaches the tier variant (the whole point)", () => {
	const out = applyOverride(model, { contextWindow: 400_000 });
	assert.equal(out.contextWindow, 400_000);
	assert.equal(out.cost.input, 0.0784, "cost must stay tier-adjusted");
});

test("the variant override wins field by field over the inherited base one", () => {
	const merged = mergeOverrides({ contextWindow: 400_000, cost: { output: 0.3 } }, { maxTokens: 65_536 });
	assert.deepEqual(merged, { contextWindow: 400_000, maxTokens: 65_536, cost: { output: 0.3 } });
	const out = applyOverride(model, merged);
	assert.equal(out.contextWindow, 400_000);
	assert.equal(out.maxTokens, 65_536);
	assert.equal(out.cost.output, 0.3);
	assert.equal(out.cost.input, 0.0784, "untouched rate survives the merge");
});

test("cost merges per field, other scalars replace", () => {
	const out = applyOverride(model, { cost: { input: 0.5 }, name: "custom" });
	assert.equal(out.cost.input, 0.5);
	assert.equal(out.cost.output, 0.2352);
	assert.equal(out.name, "custom");
});

test("thinkingLevelMap merges, so hiding one level keeps the rest", () => {
	const base = { ...model, thinkingLevelMap: { off: "none", max: "max" } };
	const out = applyOverride(base, { thinkingLevelMap: { max: null } });
	assert.deepEqual(out.thinkingLevelMap, { off: "none", max: null });
});

test("no override is an identity", () => {
	assert.equal(applyOverride(model, undefined), model);
	assert.deepEqual(mergeOverrides(undefined, undefined), {});
});

test("pickOverrides reads only the provider's map and survives junk", () => {
	const config = { providers: { deepinfra: { modelOverrides: { "a/b": { contextWindow: 5 }, bad: 3 } } } };
	assert.deepEqual(pickOverrides(config, "deepinfra"), { "a/b": { contextWindow: 5 } });
	assert.deepEqual(pickOverrides(config, "other"), {});
	assert.deepEqual(pickOverrides(null, "deepinfra"), {});
});

test("parseModelsJson tolerates comments and trailing commas", () => {
	const text = `{
	  // the deepinfra provider
	  "providers": { "deepinfra": { "modelOverrides": { "a/b": { "contextWindow": 5 } } } },
	}`;
	assert.deepEqual(pickOverrides(parseModelsJson(text), "deepinfra"), { "a/b": { contextWindow: 5 } });
	assert.equal(parseModelsJson("not json at all"), undefined);
});
