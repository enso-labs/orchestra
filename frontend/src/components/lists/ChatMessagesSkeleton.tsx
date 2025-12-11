import { Skeleton } from "@/components/ui/skeleton";

export default function ChatMessagesSkeleton() {
	return (
		<div className="flex flex-col h-full min-h-0 overflow-hidden">
			<div className="flex-1 overflow-hidden p-1 mb-1 pb-5">
				<div className="max-w-4xl mx-auto px-5 relative flex flex-col gap-6 pt-4">
					{/* Fake history */}

					{/* User message */}
					<div className="p-2 rounded-md flex justify-end">
						<div className="max-w-[80%] md:max-w-[70%] w-full">
							<Skeleton className="h-12 w-3/4 ml-auto rounded-xl rounded-br-sm" />
						</div>
					</div>

					{/* AI message */}
					<div className="px-3 md:px-5">
						<div className="max-w-[90vw] md:max-w-[80%] w-full">
							<Skeleton className="h-24 w-full rounded-lg rounded-bl-sm" />
							<div className="flex gap-2 mt-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-12" />
							</div>
						</div>
					</div>

					{/* User message */}
					<div className="p-2 rounded-md flex justify-end">
						<div className="max-w-[80%] md:max-w-[70%] w-full">
							<Skeleton className="h-8 w-1/2 ml-auto rounded-xl rounded-br-sm" />
						</div>
					</div>

					{/* AI message */}
					<div className="px-3 md:px-5">
						<div className="max-w-[90vw] md:max-w-[80%] w-full">
							<Skeleton className="h-40 w-full rounded-lg rounded-bl-sm" />
							<div className="flex gap-2 mt-2">
								<Skeleton className="h-4 w-24" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
