import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformToolsPanel } from "../PlatformToolsPanel";
import { Tool } from "../types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTools: Tool[] = [
  {
    name: "web_search",
    description: "Search the web for information",
    tags: ["search", "web"],
  },
  {
    name: "code_interpreter",
    description: "Execute Python code",
    tags: ["code", "utility"],
  },
  {
    name: "file_reader",
    description: "Read files from disk",
    tags: ["utility"],
  },
  {
    name: "image_gen",
    description: "Generate images from text",
    tags: ["media"],
  },
  {
    name: "web_scraper",
    description: "Scrape web pages",
    tags: ["search", "web"],
  },
];

describe("PlatformToolsPanel", () => {
  let onToggleSelection: ReturnType<typeof vi.fn>;
  let onSelectMultiple: ReturnType<typeof vi.fn>;
  let onDeselectMultiple: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onToggleSelection = vi.fn();
    onSelectMultiple = vi.fn();
    onDeselectMultiple = vi.fn();
  });

  function renderPanel(overrides: Partial<Parameters<typeof PlatformToolsPanel>[0]> = {}) {
    return render(
      <PlatformToolsPanel
        tools={mockTools}
        selectedTools={new Set<string>()}
        onToggleSelection={onToggleSelection}
        onSelectMultiple={onSelectMultiple}
        onDeselectMultiple={onDeselectMultiple}
        {...overrides}
      />,
    );
  }

  describe("All chip", () => {
    it("renders and is active by default", () => {
      renderPanel();
      const allChip = screen.getByText(`All (${mockTools.length})`);
      expect(allChip).toBeInTheDocument();
      expect(allChip).toHaveClass("bg-primary");
    });
  });

  describe("Tag chips", () => {
    it("renders tag chips with correct names and counts", () => {
      renderPanel();
      // Tags sorted alphabetically: code, media, search, utility, web
      expect(screen.getByText("code (1)")).toBeInTheDocument();
      expect(screen.getByText("media (1)")).toBeInTheDocument();
      expect(screen.getByText("search (2)")).toBeInTheDocument();
      expect(screen.getByText("utility (2)")).toBeInTheDocument();
      expect(screen.getByText("web (2)")).toBeInTheDocument();
    });

    it("filters the tool grid when a tag chip is clicked", () => {
      renderPanel();
      fireEvent.click(screen.getByText("media (1)"));

      // Only image_gen has the "media" tag
      expect(screen.getByText("image_gen")).toBeInTheDocument();
      expect(screen.queryByText("web_search")).not.toBeInTheDocument();
      expect(screen.queryByText("code_interpreter")).not.toBeInTheDocument();
    });

    it("clears the tag filter when All is clicked", () => {
      renderPanel();

      // Activate a tag filter
      fireEvent.click(screen.getByText("media (1)"));
      expect(screen.queryByText("web_search")).not.toBeInTheDocument();

      // Click All to clear filter
      fireEvent.click(screen.getByText(`All (${mockTools.length})`));
      expect(screen.getByText("web_search")).toBeInTheDocument();
      expect(screen.getByText("code_interpreter")).toBeInTheDocument();
      expect(screen.getByText("image_gen")).toBeInTheDocument();
    });

    it("toggles off the active tag when clicked again", () => {
      renderPanel();
      const mediaChip = screen.getByText("media (1)");

      // Activate
      fireEvent.click(mediaChip);
      expect(screen.queryByText("web_search")).not.toBeInTheDocument();

      // Click again to deactivate (toggle off)
      fireEvent.click(screen.getByText("media (1)"));
      expect(screen.getByText("web_search")).toBeInTheDocument();
    });
  });

  describe("Text search and tag filtering together", () => {
    it("combines text search with tag filtering", () => {
      renderPanel();

      // Search for "web" then filter by "search" tag
      fireEvent.change(screen.getByPlaceholderText("Search tools..."), {
        target: { value: "web" },
      });

      // "web" matches: web_search (name+tag), web_scraper (name+tag)
      // Also file_reader does NOT match
      expect(screen.getByText("web_search")).toBeInTheDocument();
      expect(screen.getByText("web_scraper")).toBeInTheDocument();
      expect(screen.queryByText("file_reader")).not.toBeInTheDocument();

      // Now also filter by "search" tag
      fireEvent.click(screen.getByText("search (2)"));
      expect(screen.getByText("web_search")).toBeInTheDocument();
      expect(screen.getByText("web_scraper")).toBeInTheDocument();
    });

    it("updates tag counts based on text search", () => {
      renderPanel();

      // Search for "code" - only code_interpreter matches
      fireEvent.change(screen.getByPlaceholderText("Search tools..."), {
        target: { value: "code" },
      });

      // All chip should show 1 (only code_interpreter matches text search)
      expect(screen.getByText("All (1)")).toBeInTheDocument();
      // code tag count should be 1, utility should be 1 (code_interpreter has both)
      expect(screen.getByText("code (1)")).toBeInTheDocument();
      expect(screen.getByText("utility (1)")).toBeInTheDocument();
    });
  });

  describe("Zero-count tags", () => {
    it("appears dimmed when tag has zero matching tools", () => {
      renderPanel();

      // Search for something that only matches "media" tag tools
      fireEvent.change(screen.getByPlaceholderText("Search tools..."), {
        target: { value: "image" },
      });

      // Only image_gen matches, so only "media" tag has count > 0
      const mediaChip = screen.getByText("media (1)");
      expect(mediaChip).not.toHaveClass("text-muted-foreground/50");

      // "search" tag should have 0 count and be dimmed
      const searchChip = screen.getByText("search (0)");
      expect(searchChip).toHaveClass("text-muted-foreground/50");
    });
  });

  describe("Batch Enable/Disable buttons", () => {
    it("shows Enable All and Disable All when a tag is active", () => {
      renderPanel();

      // No batch buttons when All is active
      expect(screen.queryByText("Enable All")).not.toBeInTheDocument();
      expect(screen.queryByText("Disable All")).not.toBeInTheDocument();

      // Click a tag
      fireEvent.click(screen.getByText("search (2)"));

      expect(screen.getByText("Enable All")).toBeInTheDocument();
      expect(screen.getByText("Disable All")).toBeInTheDocument();
    });

    it("hides batch buttons when All chip is active", () => {
      renderPanel();

      // Activate a tag to show buttons
      fireEvent.click(screen.getByText("search (2)"));
      expect(screen.getByText("Enable All")).toBeInTheDocument();

      // Click All to deactivate tag
      fireEvent.click(screen.getByText(`All (${mockTools.length})`));
      expect(screen.queryByText("Enable All")).not.toBeInTheDocument();
      expect(screen.queryByText("Disable All")).not.toBeInTheDocument();
    });

    it("calls onSelectMultiple with filtered tools when Enable All is clicked", () => {
      renderPanel();

      fireEvent.click(screen.getByText("search (2)"));
      fireEvent.click(screen.getByText("Enable All"));

      expect(onSelectMultiple).toHaveBeenCalledWith(["web_search", "web_scraper"]);
    });

    it("calls onDeselectMultiple with filtered tools when Disable All is clicked", () => {
      renderPanel();

      fireEvent.click(screen.getByText("search (2)"));
      fireEvent.click(screen.getByText("Disable All"));

      expect(onDeselectMultiple).toHaveBeenCalledWith(["web_search", "web_scraper"]);
    });

    it("does not show batch buttons when callbacks are not provided", () => {
      renderPanel({
        onSelectMultiple: undefined,
        onDeselectMultiple: undefined,
      });

      fireEvent.click(screen.getByText("search (2)"));
      expect(screen.queryByText("Enable All")).not.toBeInTheDocument();
      expect(screen.queryByText("Disable All")).not.toBeInTheDocument();
    });
  });
});
