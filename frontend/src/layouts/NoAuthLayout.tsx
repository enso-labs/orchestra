import useAppHook from "@/hooks/useAppHook";
import { Link, useLocation } from "react-router-dom";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";

export default function NoAuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { appVersion, useFetchAppVersionEffect } = useAppHook();
	const location = useLocation();

	useFetchAppVersionEffect();

	return (
		<div className="h-full flex flex-col bg-background">
			<main className="flex-1 flex flex-col items-center justify-center bg-background p-6">
				{location.pathname !== "/login" && (
					<div className="absolute top-4 left-4">
						<Link
							to="/login"
							className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm font-medium"
						>
							Login
						</Link>
					</div>
				)}
				<div className="absolute top-4 right-4">
					<div className="flex flex-row gap-2 items-center">
						<div className="flex-shrink-0">
							<ColorModeButton />
						</div>
					</div>
				</div>
				{children}
			</main>

			<footer className="mt-auto bg-card border-t border-border">
				<div className="px-4 sm:px-6 lg:px-8 py-4">
					<p className="text-center text-muted-foreground text-xs">
						&copy; 2025 Ensō Labs. All rights reserved. v{appVersion}
					</p>
				</div>
			</footer>
		</div>
	);
}
