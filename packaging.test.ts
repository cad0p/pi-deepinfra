import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

/**
 * Guards the published tarball, not the repo.
 *
 * Regression this exists for: `pricing.ts` was added and imported by
 * `models.ts`, but `files[]` in package.json was not updated, so the published
 * package shipped without it and pi failed to load the extension
 * (`Cannot find module './pricing'`). Tests and tsc all passed, because both run
 * against the checkout. Only the pack step saw it.
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
	files: string[];
};

const rootModules = readdirSync(new URL(".", import.meta.url))
	.filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
	.sort();

test("every root module is shipped", () => {
	for (const module of rootModules) {
		assert.ok(pkg.files.includes(module), `${module} is imported but missing from package.json files[]`);
	}
});

test("every shipped path exists", () => {
	for (const entry of pkg.files) {
		assert.ok(existsSync(new URL(entry, import.meta.url)), `files[] lists ${entry}, which does not exist`);
	}
});

test("the extension entrypoint is shipped", () => {
	assert.ok(pkg.files.includes("index.ts"), "index.ts must ship — it is the pi extension entrypoint");
});
