import assert from "node:assert/strict";
import { test } from "node:test";

import { hasTierSuffix, tierModelId, tierModelName, tiersFor, TIERS } from "./tiers.ts";

const ID = "deepseek-ai/DeepSeek-V4.1-Flash-1017";

test("every tier is registered, default first", () => {
	assert.deepEqual([...TIERS], ["default", "flex", "priority"]);
});

test("the bare id is the default tier, others are suffixed siblings", () => {
	assert.equal(tierModelId(ID, "default"), ID);
	assert.equal(tierModelId(ID, "flex"), `${ID}-flex`);
	assert.equal(tierModelId(ID, "priority"), `${ID}-priority`);
});

test("names are labelled for non-default tiers only", () => {
	assert.equal(tierModelName("DeepSeek V4.1 Flash", "default"), "DeepSeek V4.1 Flash");
	assert.equal(tierModelName("DeepSeek V4.1 Flash", "flex"), "DeepSeek V4.1 Flash (flex)");
	assert.equal(tierModelName("DeepSeek V4.1 Flash", "priority"), "DeepSeek V4.1 Flash (priority)");
});

test("an already-suffixed catalog id is not suffixed again", () => {
	for (const id of [`${ID}-flex`, `${ID}-priority`]) {
		assert.equal(hasTierSuffix(id), true);
		assert.deepEqual([...tiersFor(id)], ["default"], `${id} must not fan out`);
	}
	assert.equal(hasTierSuffix(ID), false);
	assert.deepEqual([...tiersFor(ID)], ["default", "flex", "priority"]);
});

test("model ids stay unique across tiers", () => {
	const ids = TIERS.map((tier) => tierModelId(ID, tier));
	assert.equal(new Set(ids).size, ids.length);
});
