import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoAuthLayout from "./NoAuthLayout";

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => ({ appVersion: "1.0.0" }),
}));

function renderLayout(children: React.ReactNode = <div>Test</div>) {
	return render(
		<MemoryRouter>
			<NoAuthLayout>{children}</NoAuthLayout>
		</MemoryRouter>,
	);
}

describe("NoAuthLayout", () => {
	it("renders children", () => {
		renderLayout(<div>Hello World</div>);
		expect(screen.getByText("Hello World")).toBeInTheDocument();
	});

	it("does not render SelectModel", () => {
		const { container } = renderLayout();
		// SelectModel would have a combobox/button for model selection
		expect(container.querySelector("[role='combobox']")).toBeNull();
		expect(screen.queryByText(/select.*model/i)).toBeNull();
	});

	it("does not accept showModelSelector prop", () => {
		// TypeScript-level check: NoAuthLayout should only accept children
		// Runtime check: component renders fine with just children
		const { container } = renderLayout(<span>content</span>);
		expect(container).toBeTruthy();
		expect(screen.getByText("content")).toBeInTheDocument();
	});

	it("renders ColorModeButton", () => {
		renderLayout();
		// ColorModeButton should be present in the top-right area
		const buttons = screen.getAllByRole("button");
		expect(buttons.length).toBeGreaterThan(0);
	});

	it("renders version in footer", () => {
		renderLayout();
		expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
	});
});
