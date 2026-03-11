import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ConversationThemeFrameProps {
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}

export default function ConversationThemeFrame({
	children,
	className,
	contentClassName,
}: ConversationThemeFrameProps) {
	return (
		<div
			className={cn(
				"relative flex h-full min-h-0 flex-1 overflow-hidden bg-background text-foreground",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px]"
			/>
			<div
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_62%)]"
			/>
			<div
				aria-hidden="true"
				className="absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
			/>
			<div
				aria-hidden="true"
				className="absolute bottom-[-3rem] right-[-6rem] h-80 w-80 rounded-full bg-sky-500/10 blur-3xl"
			/>
			<div
				aria-hidden="true"
				className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent"
			/>

			<div
				className={cn(
					"relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 lg:px-6 lg:pb-6 lg:pt-5",
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
