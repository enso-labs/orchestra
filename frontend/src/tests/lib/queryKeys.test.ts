import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("queryKeys", () => {
	describe("top-level keys", () => {
		it("should return user key", () => {
			expect(queryKeys.user()).toEqual(["user"]);
		});

		it("should return settings key", () => {
			expect(queryKeys.settings()).toEqual(["settings"]);
		});

		it("should return models key", () => {
			expect(queryKeys.models()).toEqual(["models"]);
		});

		it("should return projects key", () => {
			expect(queryKeys.projects()).toEqual(["projects"]);
		});

		it("should return tokens key", () => {
			expect(queryKeys.tokens()).toEqual(["tokens"]);
		});
	});

	describe("agents keys", () => {
		it("should return all agents key", () => {
			expect(queryKeys.agents.all()).toEqual(["agents"]);
		});

		it("should return agent detail key with id", () => {
			expect(queryKeys.agents.detail("abc-123")).toEqual(["agents", "abc-123"]);
		});

		it("should return public agents key with sort and tags", () => {
			expect(queryKeys.agents.public("popular", ["ai", "chat"])).toEqual([
				"agents",
				"public",
				{ sort: "popular", tags: ["ai", "chat"] },
			]);
		});
	});

	describe("threads keys", () => {
		it("should return all threads key", () => {
			expect(queryKeys.threads.all()).toEqual(["threads", undefined]);
		});

		it("should return all threads key with filter", () => {
			const filter = { metadata: { project_id: "p1" } };
			expect(queryKeys.threads.all(filter)).toEqual(["threads", filter]);
		});

		it("should return thread detail key", () => {
			expect(queryKeys.threads.detail("t-123")).toEqual(["threads", "t-123"]);
		});

		it("should return thread checkpoints key", () => {
			expect(queryKeys.threads.checkpoints("t-123")).toEqual([
				"threads",
				"t-123",
				"checkpoints",
			]);
		});
	});

	describe("memories keys", () => {
		it("should return memories key without params", () => {
			expect(queryKeys.memories()).toEqual(["memories", undefined]);
		});

		it("should return memories key with params", () => {
			const params = { query: "test", page: 2 };
			expect(queryKeys.memories(params)).toEqual(["memories", params]);
		});
	});

	describe("sandboxHealth key", () => {
		it("should return sandbox health key with url", () => {
			expect(queryKeys.sandboxHealth("http://localhost:3005")).toEqual([
				"sandboxHealth",
				"http://localhost:3005",
			]);
		});

		it("should return sandbox health key with null", () => {
			expect(queryKeys.sandboxHealth(null)).toEqual(["sandboxHealth", null]);
		});
	});

	describe("key uniqueness", () => {
		it("should produce unique keys for different entities", () => {
			const userKey = JSON.stringify(queryKeys.user());
			const settingsKey = JSON.stringify(queryKeys.settings());
			const modelsKey = JSON.stringify(queryKeys.models());
			const tokensKey = JSON.stringify(queryKeys.tokens());
			const projectsKey = JSON.stringify(queryKeys.projects());

			const allKeys = [userKey, settingsKey, modelsKey, tokensKey, projectsKey];
			const uniqueKeys = new Set(allKeys);
			expect(uniqueKeys.size).toBe(allKeys.length);
		});
	});
});
