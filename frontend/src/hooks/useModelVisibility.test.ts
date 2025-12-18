import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useModelVisibility } from "./useModelVisibility";

describe("useModelVisibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should default-enable the approved model list", () => {
    const { result } = renderHook(() => useModelVisibility());
    expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true);
    expect(result.current.isModelVisible("openai:gpt-4o")).toBe(true);
  });

  it("should toggle visibility", () => {
    const { result } = renderHook(() => useModelVisibility());

    act(() => {
      result.current.toggleModelVisibility("openai:some-experimental-model");
    });

    expect(result.current.isModelVisible("openai:some-experimental-model")).toBe(
      true,
    );

    act(() => {
      result.current.toggleModelVisibility("openai:some-experimental-model");
    });

    expect(result.current.isModelVisible("openai:some-experimental-model")).toBe(
      false,
    );
  });

  it("should persist to localStorage", () => {
    const { result } = renderHook(() => useModelVisibility());

    act(() => {
      result.current.toggleModelVisibility("openai:some-experimental-model");
    });

    const raw = localStorage.getItem("orchestra_model_visibility");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw || "{}")).toEqual(
      expect.objectContaining({
        enabledModels: expect.arrayContaining(["openai:some-experimental-model"]),
      }),
    );
  });

  it("should load from localStorage", () => {
    localStorage.setItem(
      "orchestra_model_visibility",
      JSON.stringify({ enabledModels: ["google_genai:gemini-3-pro-preview"] }),
    );
    const { result } = renderHook(() => useModelVisibility());
    expect(result.current.isModelVisible("google_genai:gemini-3-pro-preview")).toBe(
      true,
    );
    expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(false);
  });
});

