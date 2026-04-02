import { describe, it, expect } from "vitest";
import { queryClient } from "@/lib/queryClient";

describe("queryClient", () => {
	it("should be a QueryClient instance", () => {
		expect(queryClient).toBeDefined();
		expect(queryClient.getDefaultOptions).toBeDefined();
	});

	it("should have retry set to 1", () => {
		const defaults = queryClient.getDefaultOptions();
		expect(defaults.queries?.retry).toBe(1);
	});

	it("should have refetchOnWindowFocus disabled", () => {
		const defaults = queryClient.getDefaultOptions();
		expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
	});

	it("should have staleTime of 5 minutes", () => {
		const defaults = queryClient.getDefaultOptions();
		expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
	});
});
