import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEEPINFRA_EFFORTS,
	PI_THINKING_LEVELS,
	THINKING_LEVEL_MAP,
} from "./thinking.ts";

test("no pi thinking level is hidden (null)", () => {
	for (const level of PI_THINKING_LEVELS) {
		assert.notEqual(THINKING_LEVEL_MAP[level], null, `${level} is hidden (null)`);
	}
});

test("the map has no extra keys", () => {
	assert.deepEqual(Object.keys(THINKING_LEVEL_MAP).sort(), [...PI_THINKING_LEVELS].sort());
});

test("every mapped value is in DeepInfra's accepted reasoning_effort enum", () => {
	const accepted: readonly (string | null | undefined)[] = DEEPINFRA_EFFORTS;
	for (const level of PI_THINKING_LEVELS) {
		const mapped = THINKING_LEVEL_MAP[level];
		assert.ok(
			mapped !== undefined && accepted.includes(mapped),
			`${level} -> ${String(mapped)} is not an accepted reasoning_effort`,
		);
	}
});

test("levels pass through by name, except off which is DeepInfra's none", () => {
	assert.equal(THINKING_LEVEL_MAP.off, "none");
	for (const level of PI_THINKING_LEVELS.filter((entry) => entry !== "off")) {
		assert.equal(THINKING_LEVEL_MAP[level], level);
	}
});

test("xhigh and max are offered (regression: pi only offers them when mapped)", () => {
	assert.equal(THINKING_LEVEL_MAP.xhigh, "xhigh");
	assert.equal(THINKING_LEVEL_MAP.max, "max");
});
