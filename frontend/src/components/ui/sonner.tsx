import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/hooks/useTheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * The app's own `Theme` union carries a `"gray"` value that sonner does not
 * know about. `.gray` sets `--background: 220 15% 35%` with a near-white
 * `--foreground` (`styles/globals.css`), so it belongs to the dark family.
 */
const toSonnerTheme = (theme: string): ToasterProps["theme"] =>
	theme === "gray" ? "dark" : (theme as ToasterProps["theme"]);

const Toaster = ({ ...props }: ToasterProps) => {
	// Deliberately the app's ThemeContext, not `next-themes` — no
	// NextThemesProvider is mounted anywhere, so `next-themes` always
	// reported "system" and a dark UI on a light OS got white toasts.
	const { theme } = useTheme();

	return (
		<Sonner
			theme={toSonnerTheme(theme)}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
