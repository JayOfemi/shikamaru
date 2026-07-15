import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));

describe("claude plugin manifest", () => {
	it("keeps plugin.json version in lockstep with package.json", () => {
		expect(readJson(".claude-plugin/plugin.json").version).toBe(readJson("package.json").version);
	});

	it("lists the repo-root plugin in the marketplace under the plugin name", () => {
		const plugin = readJson(".claude-plugin/plugin.json");
		const entry = readJson(".claude-plugin/marketplace.json").plugins.find((p: { name: string }) => p.name === plugin.name);
		expect(entry).toBeDefined();
		expect(entry.source).toBe("./");
	});
});
