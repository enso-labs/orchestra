import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import mermaid from "mermaid";
import MarkdownCard from "./MarkdownCard";

vi.mock("mermaid", () => ({
	default: {
		initialize: vi.fn(),
		render: vi.fn(),
	},
}));

vi.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/hooks/useImageHook", () => ({
	default: () => ({
		handleImageClick: vi.fn(),
		handleImageClear: vi.fn(),
		previewImage: null,
		previewImageIndex: 0,
	}),
}));

const mermaidMock = vi.mocked(mermaid);

describe("MarkdownCard Mermaid diagrams", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mermaidMock.render.mockResolvedValue({
			svg: '<svg role="img" aria-label="test diagram" viewBox="0 0 100 100"></svg>',
			diagramType: "flowchart-v2",
		} as Awaited<ReturnType<typeof mermaid.render>>);
	});

	it("renders zoom controls for Mermaid diagrams", async () => {
		render(<MarkdownCard content={"```mermaid\nflowchart TD\nA-->B\n```"} />);

		expect(await screen.findByTestId("mermaid-diagram")).toBeInTheDocument();
		expect(screen.getByLabelText("Zoom Mermaid diagram out")).toBeEnabled();
		expect(
			screen.getByLabelText("Mermaid diagram zoom level"),
		).toHaveTextContent("100%");
		expect(screen.getByLabelText("Zoom Mermaid diagram in")).toBeEnabled();
		expect(screen.getByLabelText("Reset Mermaid diagram zoom")).toBeDisabled();
		expect(screen.getByLabelText("Copy Mermaid source")).toBeEnabled();
	});

	it("zooms Mermaid diagrams in, out, and back to default", async () => {
		render(<MarkdownCard content={"```mermaid\nflowchart TD\nA-->B\n```"} />);

		const diagram = await screen.findByTestId("mermaid-diagram");
		const svg = diagram.querySelector("svg");
		expect(svg).not.toBeNull();

		await waitFor(() => expect(svg).toHaveStyle({ width: "100%" }));

		fireEvent.click(screen.getByLabelText("Zoom Mermaid diagram in"));
		expect(
			screen.getByLabelText("Mermaid diagram zoom level"),
		).toHaveTextContent("125%");
		await waitFor(() => expect(svg).toHaveStyle({ width: "125%" }));

		fireEvent.click(screen.getByLabelText("Zoom Mermaid diagram out"));
		expect(
			screen.getByLabelText("Mermaid diagram zoom level"),
		).toHaveTextContent("100%");
		await waitFor(() => expect(svg).toHaveStyle({ width: "100%" }));

		fireEvent.click(screen.getByLabelText("Zoom Mermaid diagram in"));
		fireEvent.click(screen.getByLabelText("Reset Mermaid diagram zoom"));
		expect(
			screen.getByLabelText("Mermaid diagram zoom level"),
		).toHaveTextContent("100%");
		await waitFor(() => expect(svg).toHaveStyle({ width: "100%" }));
	});
});
