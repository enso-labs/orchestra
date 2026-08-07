import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Toaster } from "@/components/ui/sonner";

// Capture the props sonner's own Toaster is called with.
const sonnerProps = vi.fn();
vi.mock("sonner", () => ({
	Toaster: (props: Record<string, unknown>) => {
		sonnerProps(props);
		return <div data-testid="sonner-root" />;
	},
}));

const mockUseTheme = vi.fn();
vi.mock("@/hooks/useTheme", () => ({
	useTheme: () => mockUseTheme(),
}));

describe("ui/sonner Toaster", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// The app's Theme union is "dark" | "light" | "gray" | "system"; sonner only
	// understands "light" | "dark" | "system".
	it.each([
		["dark", "dark"],
		["light", "light"],
		["system", "system"],
		// .gray sets --background to 35% lightness with a near-white foreground,
		// so it belongs to the dark family.
		["gray", "dark"],
	])("maps app theme %s onto sonner theme %s", (appTheme, expected) => {
		mockUseTheme.mockReturnValue({ theme: appTheme, setTheme: vi.fn() });

		render(<Toaster />);

		expect(sonnerProps).toHaveBeenCalledWith(
			expect.objectContaining({ theme: expected }),
		);
	});

	it("reads the app's ThemeContext, not next-themes", () => {
		mockUseTheme.mockReturnValue({ theme: "dark", setTheme: vi.fn() });
		render(<Toaster />);
		expect(mockUseTheme).toHaveBeenCalled();
	});

	it("keeps the shipped toastOptions classNames bound to theme variables", () => {
		mockUseTheme.mockReturnValue({ theme: "dark", setTheme: vi.fn() });
		render(<Toaster />);

		const props = sonnerProps.mock.calls[0][0] as {
			toastOptions: { classNames: { toast: string } };
		};
		expect(props.toastOptions.classNames.toast).toContain(
			"group-[.toaster]:bg-background",
		);
		expect(props.toastOptions.classNames.toast).toContain(
			"group-[.toaster]:text-foreground",
		);
	});

	it("forwards caller props through to sonner", () => {
		mockUseTheme.mockReturnValue({ theme: "light", setTheme: vi.fn() });
		render(<Toaster position="top-center" visibleToasts={3} />);

		expect(sonnerProps).toHaveBeenCalledWith(
			expect.objectContaining({ position: "top-center", visibleToasts: 3 }),
		);
	});
});
