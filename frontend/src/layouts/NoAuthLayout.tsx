import useAppHook from "@/hooks/useAppHook";

export default function NoAuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { appVersion, useFetchAppVersionEffect } = useAppHook();

	useFetchAppVersionEffect();

	return (
		<div className="h-full flex flex-col bg-background">
			{children}
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
