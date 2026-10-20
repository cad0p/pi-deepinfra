import assert from "node:assert/strict";
import { test } from "node:test";

import { hasTierSuffix, tierModelId, TIERS } from "./tiers.ts";
import { tierWireParams } from "./wire.ts";

const ID = "deepseek-ai/DeepSeek-V4.1-Flash-1017";

test("the default tier sends nothing", () => {
	assert.equal(tierWireParams(ID, "default"), undefined);
});

test("a tier variant sends the catalog id, never its suffixed sibling", () => {
	for (const tier of TIERS) {
		const params = tierWireParams(ID, tier);
		if (!params) continue;
		assert.equal(params.model, ID);
		assert.equal(hasTierSuffix(String(params.model)), false);
		// The entry pi holds keeps the suffix — only the wire id is rewritten.
		assert.equal(hasTierSuffix(tierModelId(ID, tier)), true);
	}
});

test("the tier is sent as service_tier", () => {
	assert.deepEqual(tierWireParams(ID, "flex"), { model: ID, service_tier: "flex" });
	assert.deepEqual(tierWireParams(ID, "priority"), { model: ID, service_tier: "priority" });
});

test("a suffixed catalog id is still sent as itself", () => {
	const suffixed = `${ID}-flex`;
	assert.deepEqual(tierWireParams(suffixed, "default"), undefined);
	assert.equal(tierWireParams(suffixed, "priority")?.model, suffixed);
});
